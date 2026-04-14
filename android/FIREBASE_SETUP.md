# Firebase – Crypto Strategy (Android)

O projeto usa o mesmo Firebase do SevenCoins (project_id: sevencoins).

Para push notifications funcionarem corretamente:

1. Acesse [Firebase Console](https://console.firebase.google.com/) → projeto **sevencoins**
2. Adicione um app Android: Package name `com.sevencoins.cryptostrategy`
3. Baixe o `google-services.json` e substitua `android/app/google-services.json`

Após adicionar o app no Firebase, substitua `android/app/google-services.json` pelo JSON oficial do console (o `mobilesdk_app_id` deve corresponder ao novo pacote).
