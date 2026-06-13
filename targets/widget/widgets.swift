import WidgetKit
import SwiftUI

// MARK: - Marca CBRio
private let cbrioBG    = Color(red: 0.043, green: 0.122, blue: 0.149) // #0B1F26
private let cbrioTeal  = Color(red: 0.439, green: 0.659, blue: 0.690) // #70A8B0
private let cbrioPale  = Color(red: 0.835, green: 0.894, blue: 0.902) // #D5E4E6
private let cbrioWhite = Color(red: 0.957, green: 0.973, blue: 0.976) // #F4F8F9

// MARK: - Dados
struct Devocional: Decodable {
    let tem: Bool
    let titulo: String?
    let passagem: String?
    let passagem_texto: String?
}

struct DevocionalEntry: TimelineEntry {
    let date: Date
    let dev: Devocional?
}

// MARK: - Provider (busca o endpoint público)
struct DevocionalProvider: TimelineProvider {
    private let endpoint = URL(string: "https://www.cbrio.org/api/public/devocional/hoje")!

    func placeholder(in context: Context) -> DevocionalEntry {
        DevocionalEntry(date: Date(), dev: Devocional(tem: true, titulo: "Devocional de hoje", passagem: "Salmos 23:1", passagem_texto: nil))
    }

    func getSnapshot(in context: Context, completion: @escaping (DevocionalEntry) -> Void) {
        completion(placeholder(in: context))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DevocionalEntry>) -> Void) {
        Task {
            let dev = await fetchDevocional()
            let entry = DevocionalEntry(date: Date(), dev: dev)
            // Atualiza na próxima meia-noite (devocional muda por dia)
            let proxima = Calendar.current.nextDate(after: Date(), matching: DateComponents(hour: 0, minute: 5), matchingPolicy: .nextTime) ?? Date().addingTimeInterval(3600 * 6)
            completion(Timeline(entries: [entry], policy: .after(proxima)))
        }
    }

    private func fetchDevocional() async -> Devocional? {
        do {
            var req = URLRequest(url: endpoint)
            req.timeoutInterval = 10
            let (data, _) = try await URLSession.shared.data(for: req)
            return try JSONDecoder().decode(Devocional.self, from: data)
        } catch {
            return nil
        }
    }
}

// MARK: - Views
struct DevocionalWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: DevocionalEntry

    var body: some View {
        switch family {
        case .accessoryInline:
            Label(passagemCurta, systemImage: "book.fill")
        case .accessoryRectangular:
            lockRectangular
        case .systemMedium:
            homeMedium
        default:
            homeSmall
        }
    }

    // dados com fallback
    private var dev: Devocional? { entry.dev }
    private var temConteudo: Bool { (dev?.tem ?? false) && (dev?.passagem != nil || dev?.titulo != nil) }
    private var passagem: String { dev?.passagem ?? "" }
    private var titulo: String { dev?.titulo ?? "" }
    private var passagemCurta: String { dev?.passagem ?? "Devocional CBRio" }

    // Home pequeno
    private var homeSmall: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: "heart.fill").font(.system(size: 13)).foregroundColor(cbrioTeal)
                Text("DEVOCIONAL").font(.system(size: 9, weight: .bold)).tracking(1).foregroundColor(cbrioTeal)
                Spacer()
            }
            Spacer(minLength: 0)
            if temConteudo {
                Text(passagem).font(.system(size: 16, weight: .heavy)).foregroundColor(cbrioPale).lineLimit(1)
                Text(titulo).font(.system(size: 13, weight: .medium)).foregroundColor(cbrioWhite).lineLimit(3)
            } else {
                Text("O devocional de hoje sai em breve 💙").font(.system(size: 13)).foregroundColor(cbrioWhite).lineLimit(4)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .containerBackground(for: .widget) { cbrioBG }
        .widgetURL(URL(string: "cbrio://devocional"))
    }

    // Home médio
    private var homeMedium: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "heart.fill").font(.system(size: 14)).foregroundColor(cbrioTeal)
                Text("DEVOCIONAL CBRIO").font(.system(size: 10, weight: .bold)).tracking(2).foregroundColor(cbrioTeal)
                Spacer()
            }
            if temConteudo {
                Text(passagem).font(.system(size: 19, weight: .heavy)).foregroundColor(cbrioPale).lineLimit(1)
                Text(titulo).font(.system(size: 15, weight: .medium)).foregroundColor(cbrioWhite).lineLimit(2)
                Spacer(minLength: 0)
                HStack(spacing: 4) {
                    Text("Ler agora").font(.system(size: 12, weight: .semibold)).foregroundColor(cbrioTeal)
                    Image(systemName: "arrow.right").font(.system(size: 11, weight: .semibold)).foregroundColor(cbrioTeal)
                }
            } else {
                Spacer(minLength: 0)
                Text("O devocional de hoje sai em breve. Toque para abrir o app 💙").font(.system(size: 14)).foregroundColor(cbrioWhite).lineLimit(3)
                Spacer(minLength: 0)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .containerBackground(for: .widget) { cbrioBG }
        .widgetURL(URL(string: "cbrio://devocional"))
    }

    // Lock screen retangular
    private var lockRectangular: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text("DEVOCIONAL").font(.system(size: 9, weight: .bold)).tracking(1)
            if temConteudo {
                Text(passagem).font(.system(size: 13, weight: .heavy)).lineLimit(1)
                Text(titulo).font(.system(size: 12)).lineLimit(1)
            } else {
                Text("Sai em breve 💙").font(.system(size: 12))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .widgetURL(URL(string: "cbrio://devocional"))
    }
}

// MARK: - Widget
struct DevocionalWidget: Widget {
    let kind = "DevocionalWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DevocionalProvider()) { entry in
            DevocionalWidgetView(entry: entry)
        }
        .configurationDisplayName("Devocional CBRio")
        .description("O versículo e o tema do devocional de hoje.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
    }
}
