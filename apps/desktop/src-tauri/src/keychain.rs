const SERVICE: &str = "dev.arkai.limenvault.openai";
const ACCOUNT: &str = "api-key";

#[cfg(target_os="macos")]
pub fn load() -> Result<Option<String>,String> {
 match security_framework::passwords::get_generic_password(SERVICE,ACCOUNT) {
  Ok(b)=>String::from_utf8(b).map(Some).map_err(|_|"Invalid keychain value".into()),
  Err(e) if e.code()==-25300=>Ok(None),
  Err(_)=>Err("Keychain access denied or unavailable".into())
 }
}
#[cfg(target_os="macos")]
pub fn save(key:&str)->Result<(),String>{
 if key.trim().len()<16||key.len()>512||key.chars().any(char::is_whitespace){return Err("Invalid API key format".into())}
 security_framework::passwords::set_generic_password(SERVICE,ACCOUNT,key.as_bytes()).map_err(|_|"Unable to save in Keychain".into())
}
#[cfg(target_os="macos")]
pub fn delete()->Result<(),String>{
 match security_framework::passwords::delete_generic_password(SERVICE,ACCOUNT){Ok(())=>Ok(()),Err(e) if e.code()==-25300=>Ok(()),Err(_)=>Err("Unable to remove Keychain entry".into())}
}

#[cfg(target_os="windows")]
pub fn load()->Result<Option<String>,String>{
 win_load(SERVICE)
}
#[cfg(target_os="windows")]
pub fn save(key:&str)->Result<(),String>{
 if key.trim().len()<16||key.len()>512||key.chars().any(char::is_whitespace){return Err("Invalid API key format".into())}
 win_save(SERVICE, ACCOUNT, key)
}
#[cfg(target_os="windows")]
pub fn delete()->Result<(),String>{
 win_delete(SERVICE)
}

#[cfg(target_os="windows")]
pub(crate) fn win_load(target: &str) -> Result<Option<String>, String> {
 use windows_sys::Win32::Security::Credentials::{CredReadW, CredFree, CREDENTIALW, CRED_TYPE_GENERIC};
 let target_utf16: Vec<u16> = target.encode_utf16().chain(std::iter::once(0)).collect();
 let mut pcred: *mut CREDENTIALW = std::ptr::null_mut();
 let res = unsafe { CredReadW(target_utf16.as_ptr(), CRED_TYPE_GENERIC, 0, &mut pcred) };
 if res == 0 {
  let err = unsafe { windows_sys::Win32::Foundation::GetLastError() };
  if err == windows_sys::Win32::Foundation::ERROR_NOT_FOUND {
   return Ok(None);
  }
  return Err("Windows Credential Manager access failed".into());
 }
 if pcred.is_null() { return Ok(None); }
 let cred = unsafe { &*pcred };
 let slice = unsafe { std::slice::from_raw_parts(cred.CredentialBlob, cred.CredentialBlobSize as usize) };
 let val = String::from_utf8(slice.to_vec()).map_err(|_| "Invalid credential value".to_string());
 unsafe { CredFree(pcred as *mut _) };
 val.map(Some)
}

#[cfg(target_os="windows")]
pub(crate) fn win_save(target: &str, user: &str, secret: &str) -> Result<(), String> {
 use windows_sys::Win32::Security::Credentials::{CredWriteW, CREDENTIALW, CRED_TYPE_GENERIC, CRED_PERSIST_LOCAL_MACHINE};
 let mut target_utf16: Vec<u16> = target.encode_utf16().chain(std::iter::once(0)).collect();
 let mut user_utf16: Vec<u16> = user.encode_utf16().chain(std::iter::once(0)).collect();
 let secret_bytes = secret.as_bytes();
 
 let cred = CREDENTIALW {
  Flags: 0,
  Type: CRED_TYPE_GENERIC,
  TargetName: target_utf16.as_mut_ptr(),
  Comment: std::ptr::null_mut(),
  LastWritten: unsafe { std::mem::zeroed() },
  CredentialBlobSize: secret_bytes.len() as u32,
  CredentialBlob: secret_bytes.as_ptr() as *mut u8,
  Persist: CRED_PERSIST_LOCAL_MACHINE,
  AttributeCount: 0,
  Attributes: std::ptr::null_mut(),
  TargetAlias: std::ptr::null_mut(),
  UserName: user_utf16.as_mut_ptr(),
 };

 let res = unsafe { CredWriteW(&cred, 0) };
 if res == 0 {
  Err("Unable to save in Windows Credential Manager".into())
 } else {
  Ok(())
 }
}

#[cfg(target_os="windows")]
pub(crate) fn win_delete(target: &str) -> Result<(), String> {
 use windows_sys::Win32::Security::Credentials::{CredDeleteW, CRED_TYPE_GENERIC};
 let target_utf16: Vec<u16> = target.encode_utf16().chain(std::iter::once(0)).collect();
 let res = unsafe { CredDeleteW(target_utf16.as_ptr(), CRED_TYPE_GENERIC, 0) };
 if res == 0 {
  let err = unsafe { windows_sys::Win32::Foundation::GetLastError() };
  if err == windows_sys::Win32::Foundation::ERROR_NOT_FOUND {
   return Ok(());
  }
  return Err("Unable to remove Windows Credential Manager entry".into());
 }
 Ok(())
}

#[cfg(all(not(target_os="macos"), not(target_os="windows")))]
pub fn load()->Result<Option<String>,String>{Err("Keychain currently supported on macOS and Windows only".into())}
#[cfg(all(not(target_os="macos"), not(target_os="windows")))]
pub fn save(_: &str)->Result<(),String>{Err("Keychain currently supported on macOS and Windows only".into())}
#[cfg(all(not(target_os="macos"), not(target_os="windows")))]
pub fn delete()->Result<(),String>{Err("Keychain currently supported on macOS and Windows only".into())}

#[cfg(windows)]
#[test]
fn test_windows_credential_manager_roundtrip() {
 let target = "dev.arkai.limenvault.test.key";
 let account = "test-account";
 let secret = "sk-test-secret-123456789";
 
 let _ = win_delete(target);
 assert_eq!(win_load(target).unwrap(), None);
 win_save(target, account, secret).unwrap();
 assert_eq!(win_load(target).unwrap(), Some(secret.into()));
 win_delete(target).unwrap();
 assert_eq!(win_load(target).unwrap(), None);
}
