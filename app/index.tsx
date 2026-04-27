import { getUserName } from "@/services/userService";
import { Redirect } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export default function Index() {
  const [destination, setDestination] = useState<
    "/onboarding" | "/home" | null
  >(null);

  useEffect(() => {
    getUserName().then((name) => {
      setDestination(name ? "/home" : "/onboarding");
    });
  }, []);

  if (!destination) {
    return (
      <View style={styles.container}>
        <View style={styles.topGlow} />
        <View style={styles.bottomGlow} />
        <View style={styles.card}>
          <View style={styles.brandPill}>
            <Text style={styles.brandPillText}>RN Laporan</Text>
          </View>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.title}>Menyiapkan tampilan</Text>
          <Text style={styles.subtitle}>
            Mengecek profil dan membuka halaman yang sesuai.
          </Text>
        </View>
      </View>
    );
  }

  return <Redirect href={destination} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  topGlow: {
    position: "absolute",
    top: -120,
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#BFDBFE",
    opacity: 0.45,
  },
  bottomGlow: {
    position: "absolute",
    bottom: -100,
    left: -70,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#DBEAFE",
    opacity: 0.7,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  brandPill: {
    alignSelf: "center",
    backgroundColor: "#E0F2FE",
    borderColor: "#7DD3FC",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 16,
  },
  brandPillText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#0369A1",
    textTransform: "uppercase",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 18,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 8,
    lineHeight: 20,
    textAlign: "center",
  },
});
