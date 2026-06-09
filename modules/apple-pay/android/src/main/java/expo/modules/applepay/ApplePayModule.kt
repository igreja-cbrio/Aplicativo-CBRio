package expo.modules.applepay

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ApplePayModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ApplePay")
  }
}
