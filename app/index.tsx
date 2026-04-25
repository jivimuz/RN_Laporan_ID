import { Redirect } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { getUserName } from "../services/userService";

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
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F0F7FF" }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return <Redirect href={destination} />;
}
