import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, LogOut, Mail, Shield, BookOpen } from 'lucide-react-native';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    // Navigation will be handled by AuthContext
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* User Info Card */}
        <View style={styles.userInfoCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <User size={32} color="#3b82f6" />
            </View>
          </View>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Shield size={16} color="#6366f1" />
            <Text style={styles.roleText}>{user?.role}</Text>
          </View>
        </View>

        {/* Account Actions */}
        <View style={styles.actionsContainer}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <TouchableOpacity style={styles.actionItem}>
            <Mail size={20} color="#6b7280" />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Email</Text>
              <Text style={styles.actionSubtitle}>{user?.email}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem}>
            <Shield size={20} color="#6b7280" />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Role</Text>
              <Text style={styles.actionSubtitle}>{user?.role}</Text>
            </View>
          </TouchableOpacity>

          {user?.role === 'CANDIDATE' && user?.userType && (
            <TouchableOpacity style={styles.actionItem}>
              <BookOpen size={20} color="#6b7280" />
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Examination Type</Text>
                <Text style={styles.actionSubtitle}>
                  {user.userType.replace(/_/g, ' ').replace(/EXAMS/g, 'Exams').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.actionItem}>
            <User size={20} color="#6b7280" />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Verification Status</Text>
              <Text style={styles.actionSubtitle}>
                {user?.isVerified ? 'Verified' : 'Not Verified'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <View style={styles.signOutContainer}>
          <TouchableOpacity 
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <LogOut size={20} color="white" />
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  userInfoCard: {
    backgroundColor: '#f8fafc',
    marginHorizontal: 24,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 12,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4f46e5',
  },
  actionsContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  actionContent: {
    marginLeft: 16,
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  signOutContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  signOutButton: {
    backgroundColor: '#ef4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  signOutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
