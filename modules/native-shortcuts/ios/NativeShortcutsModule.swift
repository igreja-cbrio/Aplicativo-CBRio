import ExpoModulesCore
import UIKit

public class NativeShortcutsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativeShortcuts")
    Constants(["available": true])
    View(NativeShortcutsView.self) {
      Events("onShortcutSelect")
      Prop("labels") { (view: NativeShortcutsView, labels: [String]) in
        view.setLabels(labels)
      }
      Prop("selectedIndex") { (view: NativeShortcutsView, index: Int) in
        view.select(index)
      }
    }
  }
}

/// UITabBar independente, conforme a API pública da Apple. O UIKit controla
/// seleção, interação tátil, Liquid Glass e acessibilidade. Nenhuma lupa extra,
/// long press ou pan é implementado pelo app.
final class NativeShortcutsView: ExpoView, UITabBarDelegate {
  let onShortcutSelect = EventDispatcher()
  private let bar = UITabBar(frame: .zero)
  private var labels: [String] = []
  private var activeIndex = -1
  private let symbols = ["heart", "book", "person.2", "hand.raised", "gift"]

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    clipsToBounds = false
    bar.delegate = self
    bar.isTranslucent = true
    bar.itemPositioning = .fill
    bar.tintColor = UIColor(red: 0.16, green: 0.26, blue: 0.29, alpha: 1)
    // Não configura background/selectionIndicator: preserva o material e a
    // interação oficiais do iOS 26, inclusive Reduzir Transparência/Movimento.
    addSubview(bar)
  }

  func setLabels(_ next: [String]) {
    guard next.count == symbols.count, next != labels else { return }
    labels = next
    bar.setItems(zip(labels, symbols).enumerated().map { index, entry in
      let item = UITabBarItem(title: entry.0, image: UIImage(systemName: entry.1), tag: index)
      // Separa símbolo e legenda sem substituir o layout, a lente ou os
      // reconhecedores do UIKit. Ambos os ajustes são APIs públicas.
      item.imageInsets = UIEdgeInsets(top: -2, left: 0, bottom: 2, right: 0)
      item.titlePositionAdjustment = UIOffset(horizontal: 0, vertical: 2)
      item.accessibilityLabel = entry.0
      return item
    }, animated: false)
    select(activeIndex)
  }

  func select(_ index: Int) {
    activeIndex = index
    bar.selectedItem = bar.items?.first(where: { $0.tag == index })
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    bar.frame = bounds
  }

  func position(for bar: UIBarPositioning) -> UIBarPosition { .bottom }

  func tabBar(_ tabBar: UITabBar, didSelect item: UITabBarItem) {
    guard symbols.indices.contains(item.tag) else { return }
    activeIndex = item.tag
    onShortcutSelect(["index": item.tag])
  }
}
