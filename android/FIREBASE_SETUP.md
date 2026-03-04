# Firebase – BioGenerator Android

O projeto usa o mesmo Firebase do SevenCoins (project_id: sevencoins).

Para push notifications funcionarem corretamente:

1. Acesse [Firebase Console](https://console.firebase.google.com/) → projeto **sevencoins**
2. Adicione um app Android: Package name `com.sevencoins.biogenerator`
3. Baixe o `google-services.json` e substitua `android/app/google-services.json`

O arquivo atual contém um `mobilesdk_app_id` temporário para o cliente BioGenerator. Após adicionar o app no Firebase, use o json gerado pelo console.
