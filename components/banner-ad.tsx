import Constants, { ExecutionEnvironment } from "expo-constants";
import { StyleSheet, View } from "react-native";

export function BannerAdSlot() {
  if (
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    Constants.executionEnvironment === ExecutionEnvironment.Standalone
  ) {
    return null;
  }

  try {
    // AdMob is loaded only in a native development/release build.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BannerAd, BannerAdSize } = require(
      "react-native-google-mobile-ads",
    );

    return (
      <View style={styles.container}>
        <BannerAd
          unitId="ca-app-pub-3791184145323279/2527639067"
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        />
      </View>
    );
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    minHeight: 50,
    marginBottom: 8,
  },
});
