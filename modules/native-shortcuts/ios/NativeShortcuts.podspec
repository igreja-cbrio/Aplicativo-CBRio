Pod::Spec.new do |s|
  s.name = 'NativeShortcuts'
  s.version = '1.0.0'
  s.summary = 'Atalhos CBRio com a barra de abas do UIKit.'
  s.description = 'UITabBar do sistema, sem reconhecedores de gesto personalizados.'
  s.author = 'CBRio'
  s.homepage = 'https://cbrio.org'
  s.platforms = { :ios => '15.1' }
  s.source = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'UIKit'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
