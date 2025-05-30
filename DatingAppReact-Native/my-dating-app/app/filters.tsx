import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Switch } from 'react-native';
import { useRouter } from 'expo-router';
// Consider using a slider component for age range if available or a simpler TextInput for now
// import Slider from '@react-native-community/slider'; // Example, might need installation

interface Filters {
  minAge: number;
  maxAge: number;
  distance: number; // in km or miles
  showOnlineOnly: boolean;
  // Add more filters as needed, e.g., interests, gender preference
}

const INITIAL_FILTERS: Filters = {
  minAge: 18,
  maxAge: 99,
  distance: 50, // Default distance
  showOnlineOnly: false,
};

export default function FiltersScreen() {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);

  const handleApplyFilters = () => {
    // TODO: Implement logic to pass filters back to ExploreScreen
    // For now, we can log them and navigate back
    console.log('Applying filters:', filters);
    if (router.canGoBack()) {
      // Pass filters back to the ExploreScreen via route params
      router.replace({ pathname: '/(tabs)/explore', params: { filters: JSON.stringify(filters) } });
    } else {
      // Fallback if cannot go back (e.g., deep linked directly to filters)
      router.push({ pathname: '/(tabs)/explore', params: { filters: JSON.stringify(filters) } });
    }
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
    console.log('Filters reset');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.header}>Filter Profiles</Text>

      {/* Age Range */}
      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Age Range</Text>
        <View style={styles.ageInputContainer}>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            placeholder="Min Age"
            value={String(filters.minAge)}
            onChangeText={(text) => setFilters(prev => ({ ...prev, minAge: Number(text) || 0 }))}
            maxLength={2}
          />
          <Text style={styles.ageSeparator}>-</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            placeholder="Max Age"
            value={String(filters.maxAge)}
            onChangeText={(text) => setFilters(prev => ({ ...prev, maxAge: Number(text) || 0 }))}
            maxLength={2}
          />
        </View>
        {/* Example of using a Slider - uncomment and install if needed
        <Text>Min Age: {filters.minAge}</Text>
        <Slider
          style={{width: '100%', height: 40}}
          minimumValue={18}
          maximumValue={filters.maxAge -1}
          step={1}
          value={filters.minAge}
          onValueChange={(value) => setFilters(prev => ({ ...prev, minAge: value }))}
        />
        <Text>Max Age: {filters.maxAge}</Text>
         <Slider
          style={{width: '100%', height: 40}}
          minimumValue={filters.minAge + 1}
          maximumValue={99}
          step={1}
          value={filters.maxAge}
          onValueChange={(value) => setFilters(prev => ({ ...prev, maxAge: value }))}
        /> */}
      </View>

      {/* Distance */}
      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Maximum Distance (km)</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          placeholder="Distance"
          value={String(filters.distance)}
          onChangeText={(text) => setFilters(prev => ({ ...prev, distance: Number(text) || 0 }))}
          maxLength={4}
        />
        {/* Example of using a Slider
        <Text>{filters.distance} km</Text>
        <Slider
          style={{width: '100%', height: 40}}
          minimumValue={1}
          maximumValue={200} // Adjust max distance as needed
          step={1}
          value={filters.distance}
          onValueChange={(value) => setFilters(prev => ({ ...prev, distance: value }))}
        /> */}
      </View>

      {/* Online Only */}
      <View style={[styles.filterGroup, styles.switchGroup]}>
        <Text style={styles.filterLabel}>Show Online Users Only</Text>
        <Switch
          trackColor={{ false: "#767577", true: "#81b0ff" }}
          thumbColor={filters.showOnlineOnly ? "#f5dd4b" : "#f4f3f4"}
          ios_backgroundColor="#3e3e3e"
          onValueChange={(value) => setFilters(prev => ({ ...prev, showOnlineOnly: value }))}
          value={filters.showOnlineOnly}
        />
      </View>

      {/* Add more filters here: Interests, Gender Preference, etc. */}

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={[styles.button, styles.applyButton]} onPress={handleApplyFilters}>
          <Text style={styles.buttonText}>Apply Filters</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.resetButton]} onPress={handleResetFilters}>
          <Text style={styles.buttonText}>Reset Filters</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  contentContainer: {
    padding: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  filterGroup: {
    marginBottom: 20,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#555',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 5,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  ageInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ageSeparator: {
    marginHorizontal: 10,
    fontSize: 16,
  },
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  buttonContainer: {
    marginTop: 20,
  },
  button: {
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  applyButton: {
    backgroundColor: '#EA405A',
  },
  resetButton: {
    backgroundColor: '#777',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
