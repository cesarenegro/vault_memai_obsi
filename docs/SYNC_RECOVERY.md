# Recupero M10

- Il Vault locale rimane disponibile senza cloud. Un errore di trasferimento non deve indurre a cancellare il Vault o i file M7.
- Dopo un’interruzione di upload, aprire Trasferimenti e usare **Riprendi trasferimento interrotto**. Il piano conservato usa la stessa release; il servizio riconosce un commit già riuscito.
- Un conflitto richiede una nuova anteprima della versione corrente. Non forzare la sostituzione della versione cloud.
- Una copia scaricata viene validata prima dell’importazione e salvata come nuova cartella `LIMEN-copy-<operationId>` accanto al Vault corrente. Il percorso viene mostrato nell’esito.
- Un download interrotto conserva la propria staging `.limen-download-...`. La ripresa crea una staging nuova, senza riusare directory potenzialmente alterate. Non aprire una staging parziale come Vault affidabile.
- I piani congelati sono nell’app data directory, separati dal Vault. Non eliminarli prima di aver verificato l’esito remoto; contengono copie dei documenti selezionati e occupano spazio. La pulizia automatica delle versioni remote non è attiva.
- Disconnetti rimuove la configurazione e il token dal Portachiavi sul dispositivo; la revoca server del grant impedisce ulteriori accessi anche da altre copie del token. Disconnessione locale e revoca remota sono azioni diverse.

Limiti di collaudo correnti nella checklist: non interpretare questi passaggi come prova che il servizio sia già pubblicato o che il nuovo DMG sia certificato.
