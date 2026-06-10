import ExpoModulesCore
import PassKit

/// Botão oficial do Apple Pay (PKPaymentButton), exigido pelas HIG —
/// botões customizados com a marca Apple Pay são motivo de rejeição
/// na App Review. Tipo/estilo são imutáveis no PKPaymentButton, então
/// o botão é recriado quando essas props mudam.
class ApplePayButtonView: ExpoView {
  let onPress = EventDispatcher()

  private var button: PKPaymentButton?
  private var buttonType: PKPaymentButtonType = .donate
  private var buttonStyle: PKPaymentButtonStyle = .black
  private var corner: CGFloat = 999

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    rebuild()
  }

  func setButtonType(_ name: String) {
    buttonType = Self.type(for: name)
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
    let b = PKPaymentButton(paymentButtonType: buttonType, paymentButtonStyle: buttonStyle)
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
    // corner alto (ex.: 999) vira pílula, limitado à metade da altura
    button?.cornerRadius = min(corner, bounds.height / 2)
  }

  @objc private func pressed() {
    onPress()
  }

  static func type(for name: String) -> PKPaymentButtonType {
    switch name.lowercased() {
    case "donate": return .donate
    case "buy": return .buy
    case "checkout": return .checkout
    case "continue": return .continue
    case "instore": return .inStore
    case "plain": return .plain
    default: return .donate
    }
  }

  static func style(for name: String) -> PKPaymentButtonStyle {
    switch name.lowercased() {
    case "white": return .white
    case "whiteoutline": return .whiteOutline
    case "automatic":
      if #available(iOS 14.0, *) { return .automatic } else { return .black }
    default: return .black
    }
  }
}
