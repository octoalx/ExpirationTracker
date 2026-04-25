import { useEffect, useState } from "react";
import { Grid, View, Heading, Text } from "@adobe/react-spectrum";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeProducts: 0,
    expiredProducts: 0,
    totalIssues: 0,
  });

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((res) => res.json())
      .then((data) => setStats(data));
  }, []);

  return (
    <Grid
      areas={[
        "header header header header",
        "totalUsers activeProducts expiredProducts totalIssues",
      ]}
      columns={["1fr", "1fr", "1fr", "1fr"]}
      rows={["size-1000", "size-2400"]}
      gap="size-200"
    >
      <View gridArea="header">
        <Heading level={1}>Admin Dashboard</Heading>
      </View>
      <View
        gridArea="totalUsers"
        UNSAFE_style={{
          padding: "16px",
          backgroundColor: "var(--spectrum-global-color-gray-50)",
          borderRadius: "8px",
        }}
      >
        <Heading level={3}>Total Users</Heading>
        <Text>{stats.totalUsers}</Text>
      </View>
      <View
        gridArea="activeProducts"
        UNSAFE_style={{
          padding: "16px",
          backgroundColor: "var(--spectrum-global-color-gray-50)",
          borderRadius: "8px",
        }}
      >
        <Heading level={3}>Active Products</Heading>
        <Text>{stats.activeProducts}</Text>
      </View>
      <View
        gridArea="expiredProducts"
        UNSAFE_style={{
          padding: "16px",
          backgroundColor: "var(--spectrum-global-color-gray-50)",
          borderRadius: "8px",
        }}
      >
        <Heading level={3}>Expired Items</Heading>
        <Text>{stats.expiredProducts}</Text>
      </View>
      <View
        gridArea="totalIssues"
        UNSAFE_style={{
          padding: "16px",
          backgroundColor: "var(--spectrum-global-color-gray-50)",
          borderRadius: "8px",
        }}
      >
        <Heading level={3}>Issues</Heading>
        <Text>{stats.totalIssues}</Text>
      </View>
    </Grid>
  );
}
