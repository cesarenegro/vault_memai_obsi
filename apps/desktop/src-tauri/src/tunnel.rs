//! Optional packaged Secure MCP Tunnel. Credentials never enter command arguments/config/logs.
use serde::{Serialize,Deserialize};use serde_json::{Value,json};
use std::{sync::{Arc,Mutex},process::{Child,Command,Stdio},path::{Path,PathBuf},io::{BufRead,BufReader},time::Duration};

#[derive(Clone,Serialize,Deserialize)]#[serde(rename_all="camelCase",deny_unknown_fields)]pub struct Config{pub tunnel_id:String,pub organization_id:String,pub vault_path:String}

#[cfg(windows)]
pub struct WinJobObject {
 handle: windows_sys::Win32::Foundation::HANDLE,
}
#[cfg(windows)]
unsafe impl Send for WinJobObject {}
#[cfg(windows)]
unsafe impl Sync for WinJobObject {}

#[cfg(windows)]
impl WinJobObject {
 pub fn create() -> Result<Self, String> {
  use windows_sys::Win32::System::JobObjects::{
   CreateJobObjectW, SetInformationJobObject, JobObjectExtendedLimitInformation,
   JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
  };
  let handle = unsafe { CreateJobObjectW(std::ptr::null_mut(), std::ptr::null()) };
  if handle.is_null() || handle == 0 as _ {
   return Err("Failed to create Job Object".into());
  }
  let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = unsafe { std::mem::zeroed() };
  info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
  let res = unsafe {
   SetInformationJobObject(
    handle,
    JobObjectExtendedLimitInformation,
    &info as *const _ as *const _,
    std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
   )
  };
  if res == 0 {
   unsafe { windows_sys::Win32::Foundation::CloseHandle(handle) };
   return Err("Failed to configure Job Object limit".into());
  }
  Ok(Self { handle })
 }

 pub fn assign_process(&self, child: &Child) -> Result<(), String> {
  use std::os::windows::io::AsRawHandle;
  use windows_sys::Win32::System::JobObjects::AssignProcessToJobObject;
  let res = unsafe { AssignProcessToJobObject(self.handle, child.as_raw_handle() as _) };
  if res == 0 {
   Err("Failed to assign process to Job Object".into())
  } else {
   Ok(())
  }
 }

 pub fn terminate(&self) {
  use windows_sys::Win32::System::JobObjects::TerminateJobObject;
  unsafe {
   TerminateJobObject(self.handle, 1);
  }
 }
}

#[cfg(windows)]
impl Drop for WinJobObject {
 fn drop(&mut self) {
  self.terminate();
  unsafe {
   windows_sys::Win32::Foundation::CloseHandle(self.handle);
  }
 }
}

#[derive(Default)]
struct Running {
 generation: u64,
 child: Option<Child>,
 #[cfg(windows)]
 job: Option<Arc<WinJobObject>>,
 health: Option<PathBuf>,
 vault: Option<String>,
 error: Option<String>,
}

#[derive(Clone,Default)]pub struct TunnelState(Arc<Mutex<Running>>);
fn err(e:impl std::fmt::Display)->String{e.to_string()}
fn valid(c:&Config)->Result<(),String>{if !regex::Regex::new(r"^tunnel_[a-f0-9]{32}$").unwrap().is_match(&c.tunnel_id)||!regex::Regex::new(r"^org-[A-Za-z0-9]+$").unwrap().is_match(&c.organization_id){return Err("Invalid tunnel or organization ID".into())}if !Path::new(&c.vault_path).is_absolute(){return Err("Absolute Vault path required".into())}Ok(())}
fn private_dir(p:&Path)->Result<(),String>{
 if p.exists()&&std::fs::symlink_metadata(p).map_err(err)?.file_type().is_symlink(){return Err("Symlink configuration directory rejected".into())}
 std::fs::create_dir_all(p).map_err(err)?;
 #[cfg(unix)]
 {
  use std::os::unix::fs::PermissionsExt;
  std::fs::set_permissions(p,std::fs::Permissions::from_mode(0o700)).map_err(err)?;
 }
 Ok(())
}
fn save_file(p:&Path,bytes:&[u8])->Result<(),String>{
 use std::io::Write;
 let stage=p.with_extension("pending");
 let mut opts=std::fs::OpenOptions::new();
 opts.write(true).create_new(true);
 #[cfg(unix)]
 {
  use std::os::unix::fs::OpenOptionsExt;
  opts.mode(0o600);
 }
 let mut f=opts.open(&stage).map_err(err)?;
 f.write_all(bytes).map_err(err)?;
 f.sync_all().map_err(err)?;
 std::fs::rename(stage,p).map_err(err)
}
fn stop_child(s:&mut Running){
 #[cfg(windows)]
 {
  if let Some(job) = s.job.take() {
   job.terminate();
  }
 }
 if let Some(mut c)=s.child.take(){
  #[cfg(unix)]
  {
   unsafe{libc::kill(-(c.id() as i32),libc::SIGTERM);}
   for _ in 0..20{if c.try_wait().ok().flatten().is_some(){break}std::thread::sleep(Duration::from_millis(50));}
   unsafe{libc::kill(-(c.id() as i32),libc::SIGKILL);}
  }
  #[cfg(not(unix))]
  {
   let _ = c.kill();
  }
  let _=c.wait();
 }
 s.health=None;
 s.vault=None;
}
impl TunnelState{
 pub fn stop(&self)->Result<(),String>{let mut s=self.0.lock().map_err(err)?;s.generation=s.generation.wrapping_add(1);stop_child(&mut s);Ok(())}
 pub fn status(&self)->Result<Value,String>{let mut s=self.0.lock().map_err(err)?;if let Some(c)=s.child.as_mut(){if c.try_wait().map_err(err)?.is_some(){stop_child(&mut s);}}
 let active=s.child.is_some();let ready=if active{ s.health.as_ref().and_then(|p|std::fs::read_to_string(p).ok()).is_some_and(|u|{let u=u.trim();u.starts_with("http://127.0.0.1:")&&reqwest::blocking::Client::builder().timeout(Duration::from_secs(1)).no_proxy().build().ok().and_then(|c|c.get(format!("{u}/readyz")).send().ok()).is_some_and(|r|r.status().is_success())})}else{false};Ok(json!({"active":active,"ready":ready,"vaultPath":s.vault,"error":s.error}))}
 pub fn start(&self,c:Config,resources:&Path,data:&Path)->Result<Value,String>{valid(&c)?;let generation={let mut s=self.0.lock().map_err(err)?;s.generation=s.generation.wrapping_add(1);stop_child(&mut s);s.generation};if !crate::vault::open(Path::new(&c.vault_path)).validation.is_valid{return Err("Vault validation failed".into())}let key=load_key()?.ok_or("Configure a tunnel runtime key in Keychain")?;private_dir(data)?;
 let helper=resources.join("mcp/tunnel-client");if !helper.is_file(){return Err("Packaged tunnel component unavailable; local Vault remains usable".into())}
 let exe=std::env::current_exe().map_err(err)?;let quote=|s:&str|format!("'{}'",s.replace('\'',"'\\''"));let cmd=format!("{} --mcp-stdio {}",quote(&exe.to_string_lossy()),quote(&c.vault_path));let health=data.join("tunnel-health.url");let _=std::fs::remove_file(&health);
 let profile=json!({"config_version":1,"control_plane":{"base_url":"https://api.openai.com","tunnel_id":c.tunnel_id,"api_key":"env:CONTROL_PLANE_API_KEY"},"health":{"listen_addr":"127.0.0.1:0","url_file":health},"admin_ui":{"open_browser":false},"log":{"level":"warn","format":"json"},"mcp":{"commands":[{"channel":"main","command":cmd}]}});
 save_file(&data.join("tunnel-config.json"),&serde_json::to_vec_pretty(&c).map_err(err)?)?;save_file(&data.join("tunnel-profile.yaml"),serde_yaml::to_string(&profile).map_err(err)?.as_bytes())?;
 let mut running=self.0.lock().map_err(err)?;if running.generation!=generation{return Err("Tunnel start cancelled".into())}
 
 #[cfg(windows)]
 let job = WinJobObject::create().ok().map(Arc::new);
 let mut cmd=Command::new(helper);
 cmd.args(["run","--config"]).arg(data.join("tunnel-profile.yaml")).arg("--control-plane.organization-id").arg(&c.organization_id).env("CONTROL_PLANE_API_KEY",key).env("PATH","/usr/bin:/bin").stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::null());
 #[cfg(unix)]
 {
  use std::os::unix::process::CommandExt;
  cmd.process_group(0);
 }
 #[cfg(windows)]
 {
  use std::os::windows::process::CommandExt;
  cmd.creation_flags(0x00000004); // CREATE_SUSPENDED
 }
 let mut child=cmd.spawn().map_err(err)?;
 #[cfg(windows)]
 if let Some(ref j) = job {
  let _ = j.assign_process(&child);
  use std::os::windows::io::AsRawHandle;
  unsafe {
   windows_sys::Win32::System::Threading::ResumeThread(child.as_raw_handle() as _);
  }
 }
 let pid=child.id();let stdout=child.stdout.take().ok_or("Missing tunnel output")?;running.child=Some(child);
 #[cfg(windows)]
 { running.job = job; }
 running.health=Some(health);running.vault=Some(c.vault_path);running.error=None;drop(running);
 let shared=Arc::downgrade(&self.0);std::thread::spawn(move||{let mut failures=0;for line in BufReader::new(stdout).lines(){let Ok(line)=line else{break};if line.len()>65536{continue}let Ok(v)=serde_json::from_str::<Value>(&line)else{continue};if v["msg"].as_str().is_some_and(|m|m.contains("poll failed")){failures+=1;}if matches!(v["status_code"].as_u64(),Some(401|403))||failures>=3{if let Some(shared)=shared.upgrade(){if let Ok(mut s)=shared.lock(){if s.child.as_ref().map(Child::id)!=Some(pid){break}s.error=Some(if failures>=3{"Tunnel unavailable after three failures".into()}else{format!("Tunnel authorization failed ({})",v["status_code"])});stop_child(&mut s);}}break;}}});self.status()
 }
}
impl Drop for TunnelState{fn drop(&mut self){if Arc::strong_count(&self.0)==1{let _=self.stop();}}}
const SERVICE:&str="dev.arkai.limenvault.tunnel";
pub fn load_key()->Result<Option<String>,String>{#[cfg(target_os="macos")]{match security_framework::passwords::get_generic_password(SERVICE,"runtime-key"){Ok(b)=>String::from_utf8(b).map(Some).map_err(err),Err(e)if e.code()==-25300=>Ok(None),Err(_)=>Err("Tunnel Keychain access denied".into())}}#[cfg(not(target_os="macos"))]{Err("macOS required".into())}}
pub fn save_key(key:&str)->Result<(),String>{if key.len()<16||key.len()>512||key.chars().any(char::is_whitespace){return Err("Invalid key format".into())}#[cfg(target_os="macos")]{security_framework::passwords::set_generic_password(SERVICE,"runtime-key",key.as_bytes()).map_err(|_|"Keychain save failed".into())}#[cfg(not(target_os="macos"))]{Err("macOS required".into())}}
pub fn config(data:&Path)->Result<Option<Config>,String>{let p=data.join("tunnel-config.json");if !p.exists(){return Ok(None)}if std::fs::symlink_metadata(&p).map_err(err)?.file_type().is_symlink(){return Err("Config symlink rejected".into())}let b=std::fs::read(p).map_err(err)?;if b.len()>8192{return Err("Config oversized".into())}let c=serde_json::from_slice(&b).map_err(err)?;valid(&c)?;Ok(Some(c))}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn invalid_config_and_symlink_do_not_overwrite_files() {
        let tmp = tempfile::tempdir().unwrap();
        let victim = tmp.path().join("victim");
        std::fs::write(&victim, "preserve").unwrap();
        #[cfg(unix)]
        std::os::unix::fs::symlink(&victim, tmp.path().join("tunnel-config.json")).unwrap();
        #[cfg(windows)]
        let _ = std::os::windows::fs::symlink_file(&victim, tmp.path().join("tunnel-config.json"));
        assert!(config(tmp.path()).is_err() || !tmp.path().join("tunnel-config.json").exists());
        assert_eq!(std::fs::read_to_string(&victim).unwrap(), "preserve");
        assert!(valid(&Config {
            tunnel_id: "invalid".into(),
            organization_id: "org-demo".into(),
            vault_path: "/tmp".into()
        }).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn stop_releases_real_process_and_invalidates_inflight_start() {
        use std::os::unix::process::CommandExt;
        let state = TunnelState::default();
        let child = Command::new("/bin/sleep").arg("30").process_group(0).spawn().unwrap();
        let pid = child.id();
        let ticket = { let mut s = state.0.lock().unwrap(); s.child = Some(child); s.generation };
        state.stop().unwrap();
        let s = state.0.lock().unwrap();
        assert!(s.child.is_none());
        assert_ne!(s.generation, ticket);
        assert_eq!(unsafe { libc::kill(pid as i32, 0) }, -1);
    }

    #[cfg(windows)]
    #[test]
    fn test_job_object_process_tree_kill() {
        use std::os::windows::io::AsRawHandle;
        use std::os::windows::process::CommandExt;
        let job = WinJobObject::create().unwrap();
        let mut child = Command::new("cmd")
            .args(["/c", "start /b ping 127.0.0.1 -n 30"])
            .creation_flags(0x00000004) // CREATE_SUSPENDED
            .spawn()
            .unwrap();
        job.assign_process(&child).unwrap();
        unsafe {
            windows_sys::Win32::System::Threading::ResumeThread(child.as_raw_handle() as _);
        }
        let state = TunnelState::default();
        {
            let mut s = state.0.lock().unwrap();
            s.child = Some(child);
            s.job = Some(Arc::new(job));
        }
        state.stop().unwrap();
        let s = state.0.lock().unwrap();
        assert!(s.child.is_none());
        assert!(s.job.is_none());
    }
}
