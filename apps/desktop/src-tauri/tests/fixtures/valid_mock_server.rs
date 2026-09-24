// Lightweight mock server for unit testing llama-server lifecycle
// Responds to GET /health with 200 {"status":"ok"}
// Responds to POST /v1/embeddings with 200 {"data":[{"embedding":[...1024 floats...]}]}
use std::{io::{Read, Write}, net::TcpListener, time::{Duration, Instant}};

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let pos = args.iter().position(|a| a == "--port").expect("port argument");
    let port: u16 = args[pos + 1].parse().unwrap();
    let listener = TcpListener::bind(("127.0.0.1", port)).unwrap();
    listener.set_nonblocking(true).unwrap();
    let start = Instant::now();

    // Construct valid 1024-dimension float embedding JSON body
    let mut emb = String::with_capacity(7 * 1024);
    emb.push_str("[0.01");
    for _ in 1..1024 {
        emb.push_str(",0.01");
    }
    emb.push(']');
    let emb_body = format!("{{\"data\":[{{\"embedding\":{}}}]}}", emb);

    while start.elapsed() < Duration::from_secs(1800) {
        if let Ok((mut s, _)) = listener.accept() {
            let _ = s.set_nonblocking(false);
            let _ = s.set_read_timeout(Some(Duration::from_secs(2)));
            let mut buf = [0u8; 8192];
            let n = s.read(&mut buf).unwrap_or(0);
            let req = String::from_utf8_lossy(&buf[..n]);
            let body = if req.starts_with("GET /health") {
                "{\"status\":\"ok\"}".to_string()
            } else {
                emb_body.clone()
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
