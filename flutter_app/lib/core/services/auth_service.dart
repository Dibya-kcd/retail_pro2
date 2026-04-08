import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService();
});

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final GoogleSignIn _googleSignIn = GoogleSignIn();
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  Stream<User?> get authStateChanges => _auth.authStateChanges();

  User? get currentUser => _auth.currentUser;

  Future<void> signInWithGoogle() async {
    try {
      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
      if (googleUser == null) return;

      final GoogleSignInAuthentication googleAuth = await googleUser.authentication;
      final AuthCredential credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      final UserCredential userCredential = await _auth.signInWithCredential(credential);
      final User? user = userCredential.user;

      if (user != null) {
        await _createOrUpdateUserProfile(user);
      }
    } catch (e) {
      throw Exception('Failed to sign in with Google: $e');
    }
  }

  Future<void> _createOrUpdateUserProfile(User user) async {
    final userRef = _firestore.collection('users').doc(user.uid);
    final userSnapshot = await userRef.get();

    if (!userSnapshot.exists) {
      final userProfile = {
        'uid': user.uid,
        'name': user.displayName ?? 'User',
        'email': user.email,
        'role': user.email == "mrwater.prov1@gmail.com" ? 'Super Admin' : 'Sales Representative',
        'isActive': true,
        'companyId': 'COMP-001',
        'createdAt': FieldValue.serverTimestamp(),
        'permissions': {
          'inventory': ['read', 'write'],
          'sales': ['read', 'write'],
          'users': ['read'],
        },
      };
      await userRef.set(userProfile);
    } else {
      final existingData = userSnapshot.data() as Map<String, dynamic>;
      if (user.email == "mrwater.prov1@gmail.com" && existingData['role'] != 'Super Admin') {
        await userRef.update({'role': 'Super Admin'});
      }
    }
  }

  Future<void> signOut() async {
    try {
      await _googleSignIn.signOut();
      await _auth.signOut();
    } catch (e) {
      throw Exception('Failed to sign out: $e');
    }
  }

  Future<UserProfile?> getUserProfile(String uid) async {
    try {
      final userSnapshot = await _firestore.collection('users').doc(uid).get();
      if (userSnapshot.exists) {
        return UserProfile.fromFirestore(userSnapshot);
      }
      return null;
    } catch (e) {
      throw Exception('Failed to get user profile: $e');
    }
  }
}

class UserProfile {
  final String uid;
  final String name;
  final String email;
  final String role;
  final bool isActive;
  final List<String>? territories;
  final String? effectiveDate;
  final String? companyId;
  final DateTime? createdAt;
  final Map<String, List<String>>? permissions;

  UserProfile({
    required this.uid,
    required this.name,
    required this.email,
    required this.role,
    required this.isActive,
    this.territories,
    this.effectiveDate,
    this.companyId,
    this.createdAt,
    this.permissions,
  });

  factory UserProfile.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return UserProfile(
      uid: data['uid'] ?? '',
      name: data['name'] ?? '',
      email: data['email'] ?? '',
      role: data['role'] ?? '',
      isActive: data['isActive'] ?? false,
      territories: List<String>.from(data['territories'] ?? []),
      effectiveDate: data['effectiveDate'],
      companyId: data['companyId'],
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
      permissions: Map<String, List<String>>.from(data['permissions'] ?? {}),
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'uid': uid,
      'name': name,
      'email': email,
      'role': role,
      'isActive': isActive,
      'territories': territories,
      'effectiveDate': effectiveDate,
      'companyId': companyId,
      'createdAt': createdAt != null ? Timestamp.fromDate(createdAt!) : FieldValue.serverTimestamp(),
      'permissions': permissions,
    };
  }
}

typedef Role = String;
const List<Role> availableRoles = [
  'Super Admin',
  'Distribution Manager',
  'Sales Manager',
  'Sales Representative',
  'Warehouse Manager',
  'Warehouse Operator',
  'Accounts Executive',
  'MIS Analyst',
];
