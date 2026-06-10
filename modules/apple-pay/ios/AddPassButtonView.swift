import ExpoModulesCore
import PassKit

/// Botão OFICIAL "Add to Apple Wallet" (PKAddPassButton) — arte e ícone
/// da Wallet desenhados pelo sistema, localizados automaticamente,
/// conforme as HIG. Dá a credibilidade que o usuário Apple espera.
/// Estilo é imutável no PKAddPassButton, então recriamos ao mudar.
class AddPassButtonView: ExpoView {
  // Nome único (NÃO "onPress": colidiria com o topPress core do RN).
  let onAddPassPress = EventDispatcher()

  private var button: PKAddPassButton?
  private var buttonStyle: PKAddPassButtonStyle = .black
  private var corner: CGFloat = 8

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    rebuild()
  }

  func setButtonStyle(_ name: String) {
    buttonStyle = Self.style(for: name)
    rebuild()
  }

  func setCornerRadius(_ r: Double) {
    corner = CGFloat(r)
    applyCorner()
  }

  private func rebuild() {
    button?.removeFromSuperview()
    let b = PKAddPassButton(addPassButtonStyle: buttonStyle)
    b.addTarget(self, action: #selector(pressed), for: .touchUpInside)
    addSubview(b)
    button = b
    setNeedsLayout()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    button?.frame = bounds
    applyCorner()
  }

  private func applyCorner() {
    // PKAddPassButton não expõe cornerRadius próprio (ao contrário do
    // PKPaymentButton); arredonda via layer.
    guard let button else { return }
    button.layer.cornerRadius = min(corner, bounds.height / 2)
    button.clipsToBounds = true
  }

  @objc private func pressed() {
    onAddPassPress()
  }

  static func style(for name: String) -> PKAddPassButtonStyle {
    switch name.lowercased() {
    case "blackoutline": return .blackOutline
    default: return .black
    }
  }
}
