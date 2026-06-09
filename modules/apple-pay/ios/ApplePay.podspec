Pod::Spec.new do |s|
  s.name           = 'ApplePay'
  s.version        = '1.0.0'
  s.summary        = 'Apple Pay nativo via PassKit (CBRio).'
  s.description    = 'Expõe a sheet do Apple Pay e devolve o token cru pro JS.'
  s.author         = 'CBRio'
  s.homepage       = 'https://cbrio.org'
  s.platforms      = {
    :ios => '15.1',
    :tvos => '15.1'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'PassKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
