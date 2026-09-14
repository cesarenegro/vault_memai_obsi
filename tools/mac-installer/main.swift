import AppKit
import Foundation

struct InstallFailure: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}
final class Installer {
    let fm = FileManager.default
    let report: (String) -> Void
    init(report: @escaping (String) -> Void) { self.report = report }
    @discardableResult func run(_ tool: String, _ args: [String]) throws -> String {
        let p = Process(); p.executableURL = URL(fileURLWithPath: tool); p.arguments = args
        let output = Pipe(); p.standardOutput = output; p.standardError = output
        try p.run()
        let data = output.fileHandleForReading.readDataToEndOfFile(); p.waitUntilExit()
        let text = String(data: data, encoding: .utf8) ?? ""
        guard p.terminationStatus == 0 else { throw InstallFailure(message: "Operazione non riuscita (\(URL(fileURLWithPath: tool).lastPathComponent)): \(text.prefix(600))") }
        return text
    }
    func verify(_ app: URL, id: String, team: String) throws {
        let requirement = "anchor apple generic and identifier \"\(id)\" and certificate leaf[subject.OU] = \"\(team)\""
        try run("/usr/bin/codesign", ["--verify", "--deep", "--strict", "-R", "=" + requirement, app.path])
    }
    func copyApp(_ source: URL, to target: URL, id: String, team: String) throws {
        guard !fm.fileExists(atPath: target.path) else { throw InstallFailure(message: "Esiste già \(target.path). Nessun file è stato sostituito.") }
        let stage = target.deletingLastPathComponent().appendingPathComponent(".limen-install-\(UUID().uuidString).app")
        defer { try? fm.removeItem(at: stage) }
        try run("/usr/bin/ditto", [source.path, stage.path])
        try verify(stage, id: id, team: team)
        try fm.moveItem(at: stage, to: target)
    }
    func withImage(_ image: URL, workspace: URL, action: (URL) throws -> Void) throws {
        let mount = workspace.appendingPathComponent(UUID().uuidString)
        try fm.createDirectory(at: mount, withIntermediateDirectories: true)
        try run("/usr/bin/hdiutil", ["attach", "-readonly", "-nobrowse", "-mountpoint", mount.path, image.path])
        defer { _ = try? run("/usr/bin/hdiutil", ["detach", mount.path]) }
        try action(mount)
    }
    func existingObsidian(candidates: [URL]) -> URL? {
        candidates.first { candidate in
            guard fm.fileExists(atPath: candidate.path) else { return false }
            return (try? verify(candidate, id: "md.obsidian", team: "6JSW4SJWN9")) != nil
        }
    }
    func install(applications: URL, candidates: [URL], obsidianImage: URL? = nil) throws -> URL {
        guard ProcessInfo.processInfo.isOperatingSystemAtLeast(OperatingSystemVersion(majorVersion: 26, minorVersion: 3, patchVersion: 0)) else {
            throw InstallFailure(message: "Questa versione di LIMEN richiede macOS 26.3 o successivo.")
        }
        #if !arch(arm64)
        throw InstallFailure(message: "Questo pacchetto richiede un Mac Apple Silicon (M1 o successivo).")
        #endif
        try fm.createDirectory(at: applications, withIntermediateDirectories: true)
        let workspace = fm.temporaryDirectory.appendingPathComponent("limen-install-\(UUID().uuidString)")
        try fm.createDirectory(at: workspace, withIntermediateDirectories: true)
        defer { try? fm.removeItem(at: workspace) }
        guard let limenImage = Bundle.main.url(forResource: "LIMEN", withExtension: "dmg") else { throw InstallFailure(message: "Pacchetto LIMEN mancante. Scarica nuovamente l’installer.") }
        let target = applications.appendingPathComponent("LIMEN Vault 0.2.0.app")
        report("Installazione di LIMEN Vault…")
        try withImage(limenImage, workspace: workspace) { mount in
            let source = mount.appendingPathComponent("LIMEN Vault.app")
            try verify(source, id: "dev.arkai.limenvault", team: "ZVGX4HFZC3")
            if fm.fileExists(atPath: target.path) {
                try verify(target, id: "dev.arkai.limenvault", team: "ZVGX4HFZC3")
                guard Bundle(url: target)?.infoDictionary?["CFBundleShortVersionString"] as? String == "0.2.0" else { throw InstallFailure(message: "La destinazione contiene un’altra versione. Nessun file è stato sostituito.") }
                guard !NSWorkspace.shared.runningApplications.contains(where: {
                    $0.bundleURL?.resolvingSymlinksInPath() == target.resolvingSymlinksInPath()
                }) else { throw InstallFailure(message: "Chiudi LIMEN Vault e premi Riprova per aggiornare l’app. Il Vault rimane intatto.") }
                let prepared = applications.appendingPathComponent(".limen-update-\(UUID().uuidString).app")
                defer { try? fm.removeItem(at: prepared) }
                try copyApp(source, to: prepared, id: "dev.arkai.limenvault", team: "ZVGX4HFZC3")
                let backupDirectory = applications.appendingPathComponent("LIMEN - versioni precedenti")
                try fm.createDirectory(at: backupDirectory, withIntermediateDirectories: true)
                let backup = backupDirectory.appendingPathComponent("LIMEN Vault 0.2.0-\(UUID().uuidString).app")
                try fm.moveItem(at: target, to: backup)
                do { try fm.moveItem(at: prepared, to: target) }
                catch {
                    try fm.moveItem(at: backup, to: target)
                    throw error
                }
                report("App aggiornata. Versione precedente conservata in \(backup.path)")
            } else {
                try copyApp(source, to: target, id: "dev.arkai.limenvault", team: "ZVGX4HFZC3")
            }
        }
        report("Verifica di Obsidian…")
        if existingObsidian(candidates: candidates) != nil {
            report("Obsidian è già installato. Installazione completata.")
        } else {
            let image = obsidianImage ?? workspace.appendingPathComponent("Obsidian.dmg")
            if obsidianImage == nil {
                report("Download di Obsidian dal distributore ufficiale…")
                try run("/usr/bin/curl", ["--fail", "--location", "--silent", "--show-error", "--proto", "=https", "--proto-redir", "=https", "--connect-timeout", "30", "--max-time", "600", "--output", image.path, "https://github.com/obsidianmd/obsidian-releases/releases/download/v1.13.7/Obsidian-1.13.7.dmg"])
            }
            report("Verifica e installazione di Obsidian…")
            try withImage(image, workspace: workspace) { mount in
                let source = mount.appendingPathComponent("Obsidian.app")
                try verify(source, id: "md.obsidian", team: "6JSW4SJWN9")
                try run("/usr/sbin/spctl", ["--assess", "--type", "execute", source.path])
                try copyApp(source, to: applications.appendingPathComponent("Obsidian.app"), id: "md.obsidian", team: "6JSW4SJWN9")
            }
            report("LIMEN Vault e Obsidian installati.")
        }
        return target
    }
}
final class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    let status = NSTextField(wrappingLabelWithString: "Installa LIMEN Vault e, se manca, Obsidian.\nLe app saranno disponibili nella cartella Applicazioni del tuo account.\n\nMac Apple Silicon • macOS 26.3 o successivo\nConnessione Internet richiesta per scaricare Obsidian.")
    let button = NSButton(title: "Installa", target: nil, action: nil)
    var installed: URL?
    func applicationDidFinishLaunching(_ notification: Notification) {
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 540, height: 290), styleMask: [.titled, .closable, .miniaturizable], backing: .buffered, defer: false)
        window.title = "Installa LIMEN Vault"; window.center()
        let title = NSTextField(labelWithString: "LIMEN Vault + Obsidian")
        title.font = .boldSystemFont(ofSize: 24); title.frame = NSRect(x: 30, y: 225, width: 480, height: 35)
        status.frame = NSRect(x: 30, y: 83, width: 480, height: 125); status.font = .systemFont(ofSize: 14)
        button.frame = NSRect(x: 330, y: 25, width: 180, height: 38); button.bezelStyle = .rounded
        button.target = self; button.action = #selector(performInstall)
        for v in [title, status, button] { window.contentView?.addSubview(v) }
        window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
    }
    @objc func performInstall() {
        if let installed {
            NSWorkspace.shared.openApplication(at: installed, configuration: NSWorkspace.OpenConfiguration()) { _, error in
                DispatchQueue.main.async { if let error { self.status.stringValue = error.localizedDescription } else { NSApp.terminate(nil) } }
            }; return
        }
        button.isEnabled = false
        let home = FileManager.default.homeDirectoryForCurrentUser
        let apps = home.appendingPathComponent("Applications")
        var candidates = [apps.appendingPathComponent("Obsidian.app"), URL(fileURLWithPath: "/Applications/Obsidian.app")]
        if let registered = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "md.obsidian"), !registered.path.hasPrefix("/Volumes/") { candidates.append(registered) }
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let engine = Installer { message in DispatchQueue.main.async { self.status.stringValue = message } }
                let installed = try engine.install(applications: apps, candidates: candidates)
                DispatchQueue.main.async { self.installed = installed; self.status.stringValue = "Installazione completata.\n\nApri LIMEN Vault e crea il tuo Vault: le cartelle verranno create automaticamente nella posizione scelta."; self.button.title = "Apri LIMEN Vault"; self.button.isEnabled = true }
            } catch {
                DispatchQueue.main.async { self.status.stringValue = "\(error.localizedDescription)\n\nSe LIMEN è già stato installato, verrà conservato. Puoi riprovare senza perdere dati."; self.button.title = "Riprova"; self.button.isEnabled = true }
            }
        }
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}
if CommandLine.arguments.count >= 4 && CommandLine.arguments[1] == "--test-install" {
    do {
        let root = URL(fileURLWithPath: CommandLine.arguments[2])
        guard root.path.hasPrefix("/private/tmp/limen-installer-test-") || root.path.hasPrefix("/tmp/limen-installer-test-") else { throw InstallFailure(message: "Test root non isolata") }
        let image = URL(fileURLWithPath: CommandLine.arguments[3])
        let result = try Installer(report: { print($0) }).install(applications: root, candidates: [root.appendingPathComponent("Obsidian.app")], obsidianImage: image)
        print("PASS: \(result.path)")
    } catch { fputs("FAIL: \(error.localizedDescription)\n", stderr); exit(1) }
} else {
    let application = NSApplication.shared
    let delegate = AppDelegate(); application.delegate = delegate
    application.setActivationPolicy(.regular); application.run()
}
