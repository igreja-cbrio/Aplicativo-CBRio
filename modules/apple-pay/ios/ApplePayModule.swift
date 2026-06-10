import ExpoModulesCore
import PassKit

/// Apple Pay nativo via PassKit. Expõe só a sheet; não processa
/// pagamento. Devolve o PKPayment token cru pro JS, que envia pro
/// backend pra Stripe finalizar.
public class ApplePayModule: Module {
  private var presenter: ApplePayPresenter?

  public func definition() -> ModuleDefinition {
    Name("ApplePay")

    AsyncFunction("isAvailable") { (networks: [String]?) -> Bool in
      let parsed = (networks ?? [])
        .compactMap { ApplePayModule.network(for: $0) }
      if parsed.isEmpty {
        return PKPaymentAuthorizationController.canMakePayments()
      }
      return PKPaymentAuthorizationController.canMakePayments(usingNetworks: parsed)
    }

    View(ApplePayButtonView.self) {
      Events("onPress")

      Prop("buttonType") { (view: ApplePayButtonView, type: String) in
        view.setButtonType(type)
      }

      Prop("buttonStyle") { (view: ApplePayButtonView, style: String) in
        view.setButtonStyle(style)
      }

      Prop("cornerRadius") { (view: ApplePayButtonView, radius: Double) in
        view.setCornerRadius(radius)
      }
    }

    AsyncFunction("requestPayment") { (config: ApplePayConfig, promise: Promise) in
      DispatchQueue.main.async {
        let presenter = ApplePayPresenter(promise: promise) { [weak self] in
          self?.presenter = nil
        }
        self.presenter = presenter
        do {
          try presenter.start(config: config)
        } catch {
          self.presenter = nil
          promise.reject("APPLE_PAY_ERROR", error.localizedDescription)
        }
      }
    }
  }

  static func network(for name: String) -> PKPaymentNetwork? {
    switch name.lowercased() {
    case "visa": return .visa
    case "mastercard": return .masterCard
    case "amex", "americanexpress": return .amex
    case "discover": return .discover
    case "elo": return .elo
    case "interac": return .interac
    case "jcb": return .JCB
    case "maestro":
      if #available(iOS 12.0, *) { return .maestro } else { return nil }
    default: return nil
    }
  }
}

// MARK: - Config

struct ApplePayConfig: Record {
  @Field var merchantId: String
  @Field var countryCode: String = "BR"
  @Field var currencyCode: String = "BRL"
  @Field var amountCents: Int
  @Field var label: String = "CBRio"
  @Field var supportedNetworks: [String] = ["visa", "mastercard", "amex", "elo"]
}

// MARK: - Presenter

final class ApplePayPresenter: NSObject, PKPaymentAuthorizationControllerDelegate {
  private let promise: Promise
  private let onDone: () -> Void
  private var finished = false

  init(promise: Promise, onDone: @escaping () -> Void) {
    self.promise = promise
    self.onDone = onDone
    super.init()
  }

  func start(config: ApplePayConfig) throws {
    let request = PKPaymentRequest()
    request.merchantIdentifier = config.merchantId
    request.countryCode = config.countryCode
    request.currencyCode = config.currencyCode
    request.merchantCapabilities = [.threeDSecure]
    request.supportedNetworks = config.supportedNetworks.compactMap {
      ApplePayModule.network(for: $0)
    }
    let amount = NSDecimalNumber(value: Double(config.amountCents) / 100.0)
    request.paymentSummaryItems = [
      PKPaymentSummaryItem(label: config.label, amount: amount)
    ]

    let controller = PKPaymentAuthorizationController(paymentRequest: request)
    controller.delegate = self
    controller.present { [weak self] presented in
      guard let self else { return }
      if !presented && !self.finished {
        self.finished = true
        self.promise.reject("APPLE_PAY_UNAVAILABLE", "Não foi possível abrir o Apple Pay.")
        self.onDone()
      }
    }
  }

  func paymentAuthorizationController(
    _ controller: PKPaymentAuthorizationController,
    didAuthorizePayment payment: PKPayment,
    handler completion: @escaping (PKPaymentAuthorizationResult) -> Void
  ) {
    let token = payment.token
    let method = token.paymentMethod
    let paymentDataJson = (try? JSONSerialization.jsonObject(with: token.paymentData)) ?? [:]

    let result: [String: Any] = [
      "paymentData": paymentDataJson,
      "paymentDataBase64": token.paymentData.base64EncodedString(),
      "transactionIdentifier": token.transactionIdentifier,
      "paymentMethod": [
        "displayName": method.displayName ?? "",
        "network": method.network?.rawValue ?? "",
        "type": ApplePayPresenter.typeString(for: method.type)
      ]
    ]
    finished = true
    promise.resolve(result)
    completion(PKPaymentAuthorizationResult(status: .success, errors: nil))
  }

  func paymentAuthorizationControllerDidFinish(_ controller: PKPaymentAuthorizationController) {
    DispatchQueue.main.async {
      controller.dismiss(completion: nil)
      if !self.finished {
        self.finished = true
        self.promise.reject("APPLE_PAY_CANCELED", "Pagamento cancelado pelo usuário.")
      }
      self.onDone()
    }
  }

  static func typeString(for t: PKPaymentMethodType) -> String {
    switch t {
    case .credit: return "credit"
    case .debit: return "debit"
    case .prepaid: return "prepaid"
    case .store: return "store"
    default: return "unknown"
    }
  }
}
