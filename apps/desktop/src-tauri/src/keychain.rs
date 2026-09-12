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
#[cfg(not(target_os="macos"))]
pub fn load()->Result<Option<String>,String>{Err("Keychain currently supported on macOS only".into())}
#[cfg(not(target_os="macos"))]
pub fn save(_: &str)->Result<(),String>{Err("Keychain currently supported on macOS only".into())}
#[cfg(not(target_os="macos"))]
pub fn delete()->Result<(),String>{Err("Keychain currently supported on macOS only".into())}
