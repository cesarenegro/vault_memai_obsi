import Foundation
import AppKit
import PDFKit
import Vision

func recognize(_ image: CGImage) throws -> String {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    request.recognitionLanguages = ["it-IT", "en-US"]
    try VNImageRequestHandler(cgImage: image).perform([request])
    return (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
}
func cgImage(_ image:NSImage) throws -> CGImage {
    var rect=CGRect(origin:.zero,size:image.size)
    guard let result=image.cgImage(forProposedRect:&rect,context:nil,hints:nil) else {throw NSError(domain:"LIMEN",code:1,userInfo:[NSLocalizedDescriptionKey:"Immagine non leggibile"])}
    return result
}
func extract(_ input:String, _ ext:String) throws -> String {
    if ext == "pdf" {
        guard let document=PDFDocument(url:URL(fileURLWithPath:input)),!document.isLocked else {throw NSError(domain:"LIMEN",code:2,userInfo:[NSLocalizedDescriptionKey:"PDF corrotto o protetto da password"])}
        guard document.pageCount <= 500 else {throw NSError(domain:"LIMEN",code:3,userInfo:[NSLocalizedDescriptionKey:"PDF oltre 500 pagine"])}
        var result=""
        for index in 0..<document.pageCount {
            guard let page=document.page(at:index) else {throw NSError(domain:"LIMEN",code:4)}
            let text=page.string ?? ""
            let bounds=page.bounds(for:.mediaBox)
            guard bounds.width > 0,bounds.height > 0 else {throw NSError(domain:"LIMEN",code:5)}
            let scale=min(2200/bounds.width,3000/bounds.height)
            let thumbnail=page.thumbnail(of:CGSize(width:bounds.width*scale,height:bounds.height*scale),for:.mediaBox)
            let ocr=try recognize(cgImage(thumbnail))
            result += "\n\n## Pagina \(index+1)\n\n"
            if !text.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty {result += text}
            if text.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty {result += ocr.isEmpty ? "[Pagina senza testo riconoscibile]" : ocr}
            else if ocr.split(whereSeparator:{$0.isWhitespace}).joined() != text.split(whereSeparator:{$0.isWhitespace}).joined() {result += "\n\n### Lettura ottica della pagina (OCR)\n\n" + ocr}
            if result.utf8.count>16*1024*1024 {throw NSError(domain:"LIMEN",code:6,userInfo:[NSLocalizedDescriptionKey:"Testo estratto oltre 16 MB"])}
        }
        return result
    }
    guard let image=NSImage(contentsOfFile:input) else {throw NSError(domain:"LIMEN",code:7,userInfo:[NSLocalizedDescriptionKey:"Immagine non leggibile"])}
    let result=try recognize(cgImage(image))
    if result.isEmpty {throw NSError(domain:"LIMEN",code:8,userInfo:[NSLocalizedDescriptionKey:"Nessun testo riconoscibile nell’immagine"])}
    return result
}
let arguments=CommandLine.arguments
if arguments.count != 4 {exit(2)}
do {let text=try extract(arguments[1],arguments[2]);let data=try JSONSerialization.data(withJSONObject:["markdown":text]);try data.write(to:URL(fileURLWithPath:arguments[3]),options:.atomic)}
catch {let data=try! JSONSerialization.data(withJSONObject:["error":error.localizedDescription]);try? data.write(to:URL(fileURLWithPath:arguments[3]),options:.atomic);exit(1)}
