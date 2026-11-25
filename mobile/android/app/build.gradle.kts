import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val signingProperties = Properties()
val signingPropertiesFile = rootProject.file("key.properties")
if (signingPropertiesFile.isFile) {
    signingPropertiesFile.inputStream().use { signingProperties.load(it) }
}

fun signingValue(name: String): String? =
    when (name) {
        "storeFile" -> providers.environmentVariable("CHATNET_ANDROID_KEYSTORE_FILE").orNull
        "storePassword" -> providers.environmentVariable("CHATNET_ANDROID_KEYSTORE_PASSWORD").orNull
        "keyAlias" -> providers.environmentVariable("CHATNET_ANDROID_KEY_ALIAS").orNull
        "keyPassword" -> providers.environmentVariable("CHATNET_ANDROID_KEY_PASSWORD").orNull
        else -> null
    } ?: signingProperties.getProperty(name)

val releaseStoreFile = signingValue("storeFile")
val releaseStorePassword = signingValue("storePassword")
val releaseKeyAlias = signingValue("keyAlias")
val releaseKeyPassword = signingValue("keyPassword")
val releaseKeystore = releaseStoreFile?.let { project.file(it) }
val hasReleaseSigning = releaseKeystore?.isFile == true &&
    !releaseStorePassword.isNullOrBlank() &&
    !releaseKeyAlias.isNullOrBlank() &&
    !releaseKeyPassword.isNullOrBlank()

android {
    namespace = "cloud.codelocal.soco"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "cloud.codelocal.soco"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    buildTypes {
        release {
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.create("release") {
                    storeFile = releaseKeystore
                    storePassword = releaseStorePassword
                    keyAlias = releaseKeyAlias
                    keyPassword = releaseKeyPassword
                }
            }
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

tasks.configureEach {
    if (name.contains("Release")) {
        doFirst {
            check(hasReleaseSigning) {
                "Android release signing is not configured. Set CHATNET_ANDROID_KEYSTORE_FILE, CHATNET_ANDROID_KEYSTORE_PASSWORD, CHATNET_ANDROID_KEY_ALIAS, and CHATNET_ANDROID_KEY_PASSWORD."
            }
        }
    }
}

flutter {
    source = "../.."
}
