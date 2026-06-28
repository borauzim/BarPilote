# BarPilote Mobile

Ce dossier prépare les applications Android et iOS avec Capacitor.

## Prérequis

- Le site Django BarPilote doit être accessible en HTTPS public.
- Android APK/AAB : Android Studio et JDK installés.
- iOS : macOS, Xcode et un compte Apple Developer pour publier.

## Configuration

Remplacer l'URL placeholder par le domaine public au moment de compiler :

```bash
export BARPILOTE_APP_URL="https://votre-domaine.com"
npm install
npm run add:android
npm run add:ios
npm run sync
```

## Compilation

Android :

```bash
npm run android
```

Puis générer l'APK ou l'AAB depuis Android Studio.

iOS :

```bash
npm run ios
```

Puis compiler et signer depuis Xcode.

## Compatibilité

- Android : minSdkVersion 23, donc Android 6.0+.
- iOS : la compatibilité exacte dépendra de la version Capacitor/Xcode installée au moment de la compilation.

Aucune app ne peut garantir toutes les versions Android/iOS existantes. Les anciennes versions ne reçoivent plus les WebView, TLS et API modernes nécessaires.

## Notifications Push Android APK

L'APK utilise le plugin Capacitor Push Notifications. Le code Web BarPilote détecte automatiquement l'app native et enregistre le token FCM auprès de Django via `/proprietaire/api/fcm/token/`.

### Firebase Android

Dans Firebase Console, projet `barpilote-c03bd` :

1. Ouvrir **Paramètres du projet** > **Général**.
2. Dans **Vos applications**, ajouter une app Android.
3. Utiliser le package Android :

```text
com.barpilote.app
```

4. Télécharger `google-services.json`.
5. Après `npm run add:android`, placer ce fichier ici :

```text
mobile/android/app/google-services.json
```

6. Installer les dépendances et synchroniser :

```bash
cd mobile
npm install
npm run add:android
npm run sync
```

7. Ouvrir Android Studio :

```bash
npm run android
```

8. Compiler l'APK depuis Android Studio.

### Important

- L'URL `BARPILOTE_APP_URL` doit pointer vers un site HTTPS public BarPilote.
- Le serveur Django doit avoir `FCM_SERVICE_ACCOUNT_FILE` du même projet Firebase `barpilote-c03bd`.
- Sur Android 13+, l'utilisateur devra accepter l'autorisation de notifications.
