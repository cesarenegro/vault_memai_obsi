// Lightweight mock server producing 3-dimensional embeddings instead of 1024-dimensional
// Used for acceptance testing bounded failure on invalid model dimensions
use std::{io::{Read, Write}, net::TcpListener, time::{Duration, Instant}};

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let pos = args.iter().position(|a| a == "--port").expect("port argument");
    let port: u16 = args[pos + 1].parse().unwrap();
    let listener = TcpListener::bind(("127.0.0.1", port)).unwrap();
    listener.set_nonblocking(true).unwrap();
    let start = Instant::now();

    while start.elapsed() < Duration::from_secs(1800) {
        if let Ok((mut s, _)) = listener.accept() {
            let _ = s.set_nonblocking(false);
            let _ = s.set_read_timeout(Some(Duration::from_secs(1)));
            let mut buf = [0u8; 8192];
            let n = s.read(&mut buf).unwrap_or(0);
            let req = String::from_utf8_lossy(&buf[..n]);
            let body = if req.starts_with("GET /health") {
                "{\"status\":\"ok\"}".to_string()
            } else {
                "{\"data\":[{\"embedding\":[0.1,0.2,0.3]}]}".to_string()
            };
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(),
                body
            );
            let _ = s.write_all(response.as_bytes());
        } else {
            std::thread::sleep(Duration::from_millis(5));
        }
    }
}
