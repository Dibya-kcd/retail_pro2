# DMS Pro Flutter App

A comprehensive retail distribution management system built with Flutter, converted from the original React application. This app maintains the same flow and UX while leveraging Flutter's cross-platform capabilities.

## Features

### 🏢 Core Business Modules
- **Dashboard** - Business overview with real-time stats and charts
- **Orders Management** - Complete order lifecycle management
- **Inventory Management** - Stock tracking, low stock alerts, and product management
- **Customer Management** - Customer profiles, credit limits, and relationship management
- **Supplier Management** - Vendor relationship management
- **Warehouse Management** - Stock movement tracking and warehouse operations
- **Returns Management** - Product returns and refund processing
- **Reports & Analytics** - Business insights and performance metrics
- **User Management** - Role-based access control and user administration

### 📱 Mobile-First Features
- **Sales App** - Field sales management with beat planning
- **Approvals** - Order approval workflow for managers
- **Real-time Updates** - Live data synchronization across all devices

### 🔐 Authentication & Security
- Google Sign-In integration
- Role-based access control (8 different roles)
- Secure Firebase backend integration
- Data encryption and security best practices

## Technology Stack

### Frontend
- **Flutter** - Cross-platform UI framework
- **Dart** - Programming language
- **Flutter Riverpod** - State management
- **Go Router** - Navigation and routing
- **Flutter ScreenUtil** - Responsive design
- **Google Fonts** - Typography
- **FL Chart** - Data visualization

### Backend & Services
- **Firebase Firestore** - Real-time database
- **Firebase Authentication** - User authentication
- **Google Sign-In** - OAuth integration

### UI/UX
- **Material Design 3** - Modern design system
- **Responsive Layout** - Mobile, tablet, and desktop support
- **Dark/Light Theme** - System theme support
- **Custom Components** - Reusable widget library

## Project Structure

```
lib/
├── core/                          # Core application logic
│   ├── theme/                     # App themes and styling
│   ├── router/                    # Navigation configuration
│   └── services/                  # Core services (Firebase, Auth)
├── data/                          # Data layer
│   ├── models/                    # Data models
│   └── providers/                 # State management providers
├── features/                      # Feature modules
│   ├── auth/                      # Authentication
│   ├── dashboard/                 # Dashboard
│   ├── orders/                    # Order management
│   ├── inventory/                 # Inventory management
│   ├── customers/                 # Customer management
│   ├── suppliers/                 # Supplier management
│   ├── warehouse/                 # Warehouse management
│   ├── returns/                   # Returns management
│   ├── reports/                   # Reports and analytics
│   ├── users/                     # User management
│   ├── sales/                     # Sales mobile app
│   └── approvals/                 # Order approvals
├── widgets/                       # Reusable widgets
│   ├── common/                    # Common widgets
│   ├── order/                     # Order-specific widgets
│   ├── inventory/                 # Inventory-specific widgets
│   └── customer/                  # Customer-specific widgets
└── layout/                        # Layout components
    └── main_layout.dart           # Main app layout
```

## Getting Started

### Prerequisites
- Flutter SDK (>=3.10.0)
- Dart SDK (>=3.0.0)
- Firebase project setup
- Google Cloud Console configuration

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd flutter_app
   ```

2. **Install dependencies**
   ```bash
   flutter pub get
   ```

3. **Firebase Configuration**
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Authentication (Google Sign-In)
   - Enable Firestore Database
   - Download configuration files and update `firebase_options.dart`
   - Configure Firestore security rules

4. **Run the app**
   ```bash
   flutter run
   ```

### Firebase Setup

1. **Authentication**
   - Enable Google Sign-In provider
   - Configure OAuth consent screen

2. **Firestore Database**
   - Create database in test mode
   - Set up collections: `users`, `products`, `orders`, `customers`, `suppliers`, `companies`, `movements`, `collections`

3. **Security Rules**
   - Configure appropriate security rules for each collection
   - Ensure role-based access control

## User Roles & Permissions

The app supports 8 different user roles with specific permissions:

1. **Super Admin** - Full system access
2. **Distribution Manager** - Operations oversight
3. **Sales Manager** - Sales team management
4. **Sales Representative** - Field sales operations
5. **Warehouse Manager** - Warehouse operations
6. **Warehouse Operator** - Stock handling
7. **Accounts Executive** - Financial operations
8. **MIS Analyst** - Reports and analytics

## Key Features

### 📊 Dashboard
- Real-time business metrics
- Sales charts and trends
- Stock status overview
- Recent activity feed

### 📦 Inventory Management
- Product catalog management
- Stock level monitoring
- Low stock alerts
- Barcode scanning support
- Batch tracking

### 🛒 Order Management
- Order creation and tracking
- Approval workflows
- Multi-channel order processing
- Order status updates
- Customer order history

### 👥 Customer Management
- Customer profiles
- Credit limit management
- Outstanding balance tracking
- Customer segmentation
- Communication history

### 📱 Sales Mobile App
- Beat planning and route optimization
- On-the-go order taking
- Payment collection
- Real-time synchronization
- Offline support capabilities

## Data Models

### Core Entities
- **Product** - SKU, name, price, stock, category
- **Order** - Customer, items, status, workflow
- **Customer** - Profile, credit limit, outstanding
- **User** - Profile, role, permissions
- **Supplier** - Vendor information
- **Company** - Business entity

## UI/UX Design

### Design Principles
- **Mobile-First** - Optimized for mobile devices
- **Responsive** - Adapts to all screen sizes
- **Accessible** - WCAG compliance
- **Intuitive** - User-friendly interface
- **Consistent** - Unified design language

### Theme System
- Light and dark theme support
- Custom color palette
- Typography system
- Component styling
- Brand consistency

## Development Guidelines

### Code Organization
- Feature-based architecture
- Clean architecture principles
- Separation of concerns
- Reusable components
- Consistent naming conventions

### State Management
- Riverpod for state management
- Provider pattern for dependencies
- Reactive data streams
- Optimistic updates
- Error handling

### Best Practices
- Type safety with Dart
- Null safety compliance
- Widget composition
- Performance optimization
- Memory management

## Testing

### Unit Tests
- Model validation
- Business logic
- Utility functions

### Widget Tests
- UI component testing
- User interactions
- Layout verification

### Integration Tests
- End-to-end workflows
- API integration
- Data flow validation

## Deployment

### Build Commands
```bash
# Debug build
flutter build apk --debug

# Release build (Android)
flutter build apk --release

# Release build (iOS)
flutter build ios --release

# Web build
flutter build web
```

### Platform-Specific Setup
- **Android**: Configure signing keys
- **iOS**: Provisioning profiles
- **Web**: Hosting configuration
- **Desktop**: Platform-specific packaging

## Contributing

1. Follow the established code style
2. Write comprehensive tests
3. Update documentation
4. Create pull requests
5. Code review process

## Support

For technical support and questions:
- Review the documentation
- Check existing issues
- Create detailed bug reports
- Provide reproduction steps

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Roadmap

### Upcoming Features
- [ ] Offline mode support
- [ ] Push notifications
- [ ] Advanced analytics
- [ ] Multi-language support
- [ ] API integrations
- [ ] Advanced reporting
- [ ] Barcode scanner integration
- [ ] GPS tracking for sales reps

### Performance Improvements
- [ ] Caching optimization
- [ ] Data compression
- [ ] Image optimization
- [ ] Lazy loading
- [ ] Background processing

---

**Note**: This Flutter app maintains complete feature parity with the original React application while providing enhanced performance, cross-platform compatibility, and a modern mobile-first user experience.
