//! Misura del ricalcolo della cache semantica (21/09/2026): esegue lo stesso codice del prodotto
//! (`sync_embeddings_with_port`) su un vault di prova e stampa i tempi per lotto se LIMEN_SYNC_TIMING e' impostata.
//! Uso: LIMEN_LOCAL_PORT=<porta> LIMEN_SYNC_TIMING=1 [LIMEN_SYNC_BATCH=n] sync_timing <vault>
use limen_vault::embeddings::sync_embeddings_with_port;
use std::{path::PathBuf, time::Instant};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let vault = PathBuf::from(std::env::args().nth(1).expect("percorso del vault"));
    let port: u16 = std::env::var("LIMEN_LOCAL_PORT")?.parse()?;
    let t0 = Instant::now();
    let rep = sync_embeddings_with_port(&vault, "", Some("bge-m3"), Some(port)).await?;
    println!(
        "RISULTATO totale_s={:.1} passaggi_totali={} in_cache={} mancanti={} copertura={:.3}",
        t0.elapsed().as_secs_f64(), rep.total_passages, rep.cached_passages, rep.missing_passages, rep.coverage
    );
    Ok(())
}
