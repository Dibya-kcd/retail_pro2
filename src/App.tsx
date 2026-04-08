/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User as FirebaseUser } from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, getDoc, getDocs, updateDoc, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  ShoppingCart, 
  MapPin, 
  LogOut, 
  Menu,
  X,
  TrendingUp,
  AlertCircle,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Download,
  Calendar,
  History,
  Tag,
  ClipboardList,
  Bell,
  Plus,
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  Warehouse,
  Truck,
  Building2,
  ArrowLeftRight,
  CheckSquare,
  FileText,
  Shield,
  ChevronRight,
  ChevronLeft,
  PlusCircle,
  MoreVertical,
  Camera,
  Eye,
  IndianRupee,
  UserCog,
  UserPlus,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './lib/utils';

import { Toaster, toast } from 'sonner';
import Fuse from 'fuse.js';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

// --- Types ---
type Role = 'Super Admin' | 'Distribution Manager' | 'Sales Manager' | 'Sales Representative' | 'Warehouse Manager' | 'Warehouse Operator' | 'Accounts Executive' | 'MIS Analyst';

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  territories?: string[];
  effectiveDate?: string;
  companyId?: string;
  createdAt?: string;
  permissions?: {
    inventory?: string[];
    sales?: string[];
    users?: string[];
  };
}

// --- Components ---

const BarcodeScanner = ({ onScan, onClose }: { onScan: (data: string) => void, onClose: () => void }) => {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    scanner.render((decodedText) => {
      onScan(decodedText);
      scanner.clear();
    }, (error) => {
      // console.warn(error);
    });

    return () => {
      scanner.clear().catch(error => console.error("Failed to clear scanner", error));
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-md">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold">Scan Barcode</h3>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors"><X size={20} /></button>
        </div>
        <div id="reader" className="overflow-hidden rounded-2xl border-2 border-zinc-100"></div>
        <p className="text-center text-xs text-zinc-500 mt-4">Align the barcode within the frame to scan</p>
      </div>
    </div>
  );
};

const QuickOrderModal = ({ isOpen, onClose, products, onAddOrder }: { isOpen: boolean, onClose: () => void, products: any[], onAddOrder: (o: any) => void }) => {
  const [step, setStep] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [orderType, setOrderType] = useState<'Regular' | 'Urgent' | 'Sample' | 'Return'>('Regular');
  const [cart, setCart] = useState<{ sku: string, name: string, qty: number, price: number, stock: number }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const handleScan = (barcode: string) => {
    const product = products.find(p => p.barcode === barcode);
    if (product) {
      addToCart(product);
      toast.success(`Added ${product.name} to cart`);
    } else {
      toast.error(`Product with barcode ${barcode} not found`);
    }
    setIsScannerOpen(false);
  };

  const customers = [
    { id: 'C-001', name: 'Krishna General Store', outstanding: 12500, limit: 50000, type: 'Retailer' },
    { id: 'C-002', name: 'City Wholesalers', outstanding: 85000, limit: 200000, type: 'Wholesaler' },
    { id: 'C-003', name: 'Modern Retail Hub', outstanding: 0, limit: 30000, type: 'Retailer' },
  ];

  const filteredProducts = searchQuery 
    ? products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
    : products;

  const addToCart = (p: any) => {
    if (p.stock <= 0) {
      toast.error('Out of stock!');
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.sku === p.sku);
      if (existing) {
        if (existing.qty >= p.stock) {
          toast.error('Cannot add more than available stock');
          return prev;
        }
        return prev.map(item => item.sku === p.sku ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { sku: p.sku, name: p.name, qty: 1, price: p.ptr, stock: p.stock }];
    });
    toast.success(`Added ${p.name} to cart`);
  };

  const removeFromCart = (sku: string) => {
    setCart(prev => prev.filter(item => item.sku !== sku));
  };

  const totalAmount = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const isOverCreditLimit = selectedCustomer && (selectedCustomer.outstanding + totalAmount > selectedCustomer.limit);

  const handlePlaceOrder = () => {
    if (isOverCreditLimit) {
      toast.warning('Order exceeds credit limit. Will be sent for approval.');
    }

    const requiresApproval = totalAmount > 50000 || isOverCreditLimit;
    const newOrder = {
      id: `ORD-2024-${Math.floor(Math.random() * 1000)}`,
      customer: selectedCustomer.name,
      amount: totalAmount,
      status: requiresApproval ? 'On Hold' : 'Pending',
      workflow: requiresApproval ? 'Manager Approval' : 'Processing',
      channel: 'Web Portal',
      date: new Date().toISOString().split('T')[0],
      items: cart
    };

    toast.promise(new Promise(res => setTimeout(() => {
      onAddOrder(newOrder);
      res(true);
    }, 1500)), {
      loading: 'Processing order...',
      success: requiresApproval ? 'Order submitted for approval!' : 'Order placed successfully!',
      error: 'Failed to place order',
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
          <div>
            <h2 className="text-xl font-bold">Order Booking Portal</h2>
            <p className="text-xs text-zinc-500">Channel: Web Portal (Office Entry)</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 ? (
            <div className="space-y-6">
              <div className="space-y-4">
                <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">1. Select Customer & Order Type</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase">Order Type</label>
                    <select 
                      value={orderType}
                      onChange={(e) => setOrderType(e.target.value as any)}
                      className="w-full p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-zinc-900"
                    >
                      <option>Regular</option>
                      <option>Urgent</option>
                      <option>Sample</option>
                      <option>Return</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase">Customer</label>
                  <div className="grid grid-cols-1 gap-2">
                    {customers.map(c => (
                      <button 
                        key={c.id}
                        onClick={() => { setSelectedCustomer(c); setStep(2); }}
                        className={cn(
                          "w-full p-4 rounded-2xl border text-left transition-all flex justify-between items-center group",
                          selectedCustomer?.id === c.id ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 hover:border-zinc-900 bg-white"
                        )}
                      >
                        <div>
                          <p className="font-bold">{c.name}</p>
                          <p className={cn("text-xs", selectedCustomer?.id === c.id ? "text-zinc-400" : "text-zinc-500")}>
                            Outstanding: ₹{c.outstanding.toLocaleString()} | Limit: ₹{c.limit.toLocaleString()}
                          </p>
                        </div>
                        <ChevronRight size={16} className={cn(selectedCustomer?.id === c.id ? "text-white" : "text-zinc-300")} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-zinc-900 text-white p-4 rounded-2xl">
                <div>
                  <p className="text-[10px] font-bold uppercase text-zinc-400">Booking for</p>
                  <p className="font-bold">{selectedCustomer?.name}</p>
                </div>
                <button onClick={() => setStep(1)} className="text-xs font-bold text-zinc-400 hover:text-white underline">Change</button>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search products, brands, or scan barcode..." 
                    className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                  />
                </div>
                
                <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-2">
                  {filteredProducts.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-white border border-zinc-100 rounded-xl hover:border-zinc-300 transition-all">
                      <div>
                        <p className="font-bold text-sm">{p.name}</p>
                        <div className="flex gap-2 items-center">
                          <p className="text-xs font-bold text-zinc-900">₹{p.price}</p>
                          <p className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded",
                            p.stock < 20 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                          )}>
                            Stock: {p.stock}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => addToCart(p)}
                        disabled={p.stock <= 0}
                        className="w-8 h-8 bg-zinc-900 text-white rounded-lg flex items-center justify-center hover:bg-zinc-800 transition-all disabled:opacity-50"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {cart.length > 0 && (
                <div className="pt-6 border-t border-zinc-100 space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-bold uppercase tracking-widest text-zinc-400">Order Summary</p>
                    <span className="text-xs font-bold px-2 py-1 bg-blue-50 text-blue-600 rounded-lg">Scheme Applied: Buy 10 Get 1</span>
                  </div>
                  <div className="space-y-2">
                    {cart.map(item => (
                      <div key={item.id} className="flex justify-between items-center p-3 bg-zinc-50 rounded-xl">
                        <div className="flex-1">
                          <p className="text-sm font-bold">{item.name}</p>
                          <p className="text-xs text-zinc-500">₹{item.price} x {item.qty}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-sm">₹{item.price * item.qty}</span>
                          <button onClick={() => removeFromCart(item.id)} className="text-rose-500 p-1 hover:bg-rose-50 rounded-lg">
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 bg-zinc-900 text-white rounded-2xl space-y-2">
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>Subtotal</span>
                      <span>₹{totalAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs text-emerald-400">
                      <span>Scheme Discount</span>
                      <span>- ₹{(totalAmount * 0.05).toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-white/10 font-black text-xl">
                      <span>Total</span>
                      <span>₹{(totalAmount * 0.95).toLocaleString()}</span>
                    </div>
                  </div>

                  {isOverCreditLimit && (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-600">
                      <AlertCircle size={16} />
                      <p className="text-[10px] font-bold uppercase">Credit Limit Exceeded: Approval Required</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button className="flex-1 py-4 bg-zinc-100 text-zinc-900 rounded-2xl font-bold hover:bg-zinc-200 transition-all">
                      Save Draft
                    </button>
                    <button 
                      onClick={handlePlaceOrder}
                      className="flex-[2] py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
                    >
                      {totalAmount > 50000 || isOverCreditLimit ? 'Submit for Approval' : 'Place Order'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const AddProductModal = ({ isOpen, onClose, onAdd, companies }: { isOpen: boolean, onClose: () => void, onAdd: (p: any) => void, companies: any[] }) => {
  const [formData, setFormData] = useState({
    sku: '', name: '', brand: companies[0]?.code || 'HUL', category: 'Laundry', mrp: 0, ptr: 0, pts: 0, stock: 0, reorderLevel: 100, barcode: '', isSerialized: false
  });
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const handleScan = (data: string) => {
    setFormData(prev => ({ ...prev, barcode: data }));
    setIsScannerOpen(false);
    toast.success(`Barcode scanned: ${data}`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
          <h2 className="text-xl font-bold">Add New Product</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-200 rounded-full transition-colors"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase">SKU Code</label>
              <input type="text" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900" placeholder="e.g. HUL-099" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase">Brand / Company</label>
              <select value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900 font-bold text-sm">
                {companies.map(c => (
                  <option key={c.id} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase">Product Name</label>
            <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900" placeholder="Full product description" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase">Barcode</label>
            <div className="flex gap-2">
              <input type="text" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} className="flex-1 p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900" placeholder="Scan or enter barcode" />
              <button 
                onClick={() => setIsScannerOpen(true)}
                className="p-3 bg-zinc-100 text-zinc-900 rounded-xl hover:bg-zinc-200 transition-all"
              >
                <Camera size={20} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase">MRP</label>
              <input type="number" value={formData.mrp} onChange={e => setFormData({...formData, mrp: Number(e.target.value)})} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase">PTR</label>
              <input type="number" value={formData.ptr} onChange={e => setFormData({...formData, ptr: Number(e.target.value)})} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase">Stock</label>
              <input type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: Number(e.target.value)})} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900" />
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
            <input 
              type="checkbox" 
              id="isSerialized"
              checked={formData.isSerialized} 
              onChange={e => setFormData({...formData, isSerialized: e.target.checked})} 
              className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
            />
            <label htmlFor="isSerialized" className="text-sm font-bold text-zinc-700">Serialized Tracking (High-Value SKU)</label>
          </div>
          <button onClick={() => onAdd({...formData, isActive: true, batches: []})} className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200">Create Product</button>
        </div>
        {isScannerOpen && <BarcodeScanner onScan={handleScan} onClose={() => setIsScannerOpen(false)} />}
      </motion.div>
    </div>
  );
};

const AddCustomerModal = ({ isOpen, onClose, onAdd }: { isOpen: boolean, onClose: () => void, onAdd: (c: any) => void }) => {
  const [formData, setFormData] = useState({
    id: `C-${Math.floor(Math.random() * 1000)}`, name: '', ownerName: '', type: 'Retailer', limit: 50000, beat: 'Beat 01', address: ''
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
          <h2 className="text-xl font-bold">Add New Customer</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-200 rounded-full transition-colors"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase">Outlet Name</label>
            <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900" placeholder="e.g. Krishna Stores" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase">Type</label>
              <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900">
                <option>Retailer</option><option>Wholesaler</option><option>Both</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase">Beat</label>
              <select value={formData.beat} onChange={e => setFormData({...formData, beat: e.target.value})} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900">
                <option>Beat 01</option><option>Beat 02</option><option>Beat 03</option><option>Beat 04</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase">Credit Limit</label>
            <input type="number" value={formData.limit} onChange={e => setFormData({...formData, limit: Number(e.target.value)})} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900" />
          </div>
          <button onClick={() => onAdd({...formData, outstanding: 0, kycStatus: 'Pending'})} className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200">Register Customer</button>
        </div>
      </motion.div>
    </div>
  );
};

const AddSupplierModal = ({ isOpen, onClose, onAdd }: { isOpen: boolean, onClose: () => void, onAdd: (s: any) => void }) => {
  const [formData, setFormData] = useState({
    id: `SUP-${Math.floor(Math.random() * 1000)}`, name: '', code: '', type: 'Principal', gstin: '', depot: '', asm: '', contact: ''
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
          <h2 className="text-xl font-bold">Add New Supplier</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-200 rounded-full transition-colors"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase">Company Name</label>
            <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900" placeholder="e.g. Nestle India" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase">Short Code</label>
              <input type="text" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900" placeholder="e.g. NES" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase">GSTIN</label>
              <input type="text" value={formData.gstin} onChange={e => setFormData({...formData, gstin: e.target.value})} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900" placeholder="27XXXXX..." />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase">ASM Name</label>
            <input type="text" value={formData.asm} onChange={e => setFormData({...formData, asm: e.target.value})} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900" />
          </div>
          <button onClick={() => onAdd(formData)} className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200">Add Supplier</button>
        </div>
      </motion.div>
    </div>
  );
};

const StockUpdateModal = ({ isOpen, onClose, product, onUpdate }: { isOpen: boolean, onClose: () => void, product: any, onUpdate: (newStock: number, movementData: any) => void }) => {
  const [adjustment, setAdjustment] = useState(0);
  const [type, setType] = useState<'grn' | 'transfer' | 'adjustment'>('grn');
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [sourceLocation, setSourceLocation] = useState('Main Warehouse');
  const [destLocation, setDestLocation] = useState('Secondary Godown');
  const [reasonCode, setReasonCode] = useState('Damaged');
  const [approver, setApprover] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (adjustment <= 0) {
      toast.error('Quantity must be greater than zero');
      return;
    }

    let newStock = product.stock;
    const movementData: any = {
      type,
      qty: adjustment,
      date: new Date().toISOString(),
      sku: product.sku,
      name: product.name,
    };

    if (type === 'grn') {
      if (!batchNumber || !expiryDate) {
        toast.error('Batch and Expiry are required for GRN');
        return;
      }
      newStock += adjustment;
      movementData.batchNumber = batchNumber;
      movementData.expiryDate = expiryDate;
      movementData.location = destLocation;
      movementData.reason = `GRN Inward to ${destLocation}`;
    } else if (type === 'transfer') {
      if (sourceLocation === destLocation) {
        toast.error('Source and Destination must be different');
        return;
      }
      movementData.source = sourceLocation;
      movementData.destination = destLocation;
      movementData.reason = `Transfer: ${sourceLocation} -> ${destLocation}`;
      // Stock total doesn't change in inter-godown transfer, but we track it
    } else if (type === 'adjustment') {
      if (!approver) {
        toast.error('Approver name is required for adjustments');
        return;
      }
      newStock -= adjustment; // Assuming adjustment is usually reduction for damage/loss
      movementData.reason = `Adjustment: ${reasonCode} (Approved by ${approver})`;
      movementData.qty = -adjustment;
    }

    onUpdate(newStock, movementData);
    toast.success(`Stock movement recorded for ${product.name}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
          <h2 className="text-xl font-bold">Stock Movement</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          <div className="flex gap-2 p-1 bg-zinc-100 rounded-2xl">
            {[
              { id: 'grn', label: 'GRN Inward' },
              { id: 'transfer', label: 'Transfer' },
              { id: 'adjustment', label: 'Adjustment' },
            ].map(t => (
              <button 
                key={t.id}
                onClick={() => setType(t.id as any)}
                className={cn(
                  "flex-1 py-2 rounded-xl text-[10px] font-bold uppercase transition-all",
                  type === t.id ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Quantity</label>
            <input 
              type="number" 
              value={adjustment}
              onChange={(e) => setAdjustment(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-2xl font-black focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
            />
          </div>

          {type === 'grn' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Batch Number</label>
                  <input 
                    type="text" 
                    placeholder="BN-2024-XXX"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    className="w-full p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Expiry Date</label>
                  <input 
                    type="date" 
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Destination Location</label>
                <select 
                  value={destLocation}
                  onChange={(e) => setDestLocation(e.target.value)}
                  className="w-full p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-zinc-900"
                >
                  <option>Main Warehouse</option>
                  <option>Secondary Godown</option>
                </select>
              </div>
            </div>
          )}

          {type === 'transfer' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Source</label>
                  <select 
                    value={sourceLocation}
                    onChange={(e) => setSourceLocation(e.target.value)}
                    className="w-full p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-zinc-900"
                  >
                    <option>Main Warehouse</option>
                    <option>Secondary Godown</option>
                    <option>Sales Van 01</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Destination</label>
                  <select 
                    value={destLocation}
                    onChange={(e) => setDestLocation(e.target.value)}
                    className="w-full p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-zinc-900"
                  >
                    <option>Main Warehouse</option>
                    <option>Secondary Godown</option>
                    <option>Sales Van 01</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {type === 'adjustment' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Reason Code</label>
                <select 
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value)}
                  className="w-full p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-zinc-900"
                >
                  <option>Damaged</option>
                  <option>Expired</option>
                  <option>Theft/Loss</option>
                  <option>Data Entry Error</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Approver Name</label>
                <input 
                  type="text" 
                  placeholder="Manager Name"
                  value={approver}
                  onChange={(e) => setApprover(e.target.value)}
                  className="w-full p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
            </div>
          )}

          <button 
            onClick={handleConfirm}
            className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
          >
            Record Movement
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const StockMovementView = ({ movements }: { movements: any[] }) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-zinc-900">Stock Movement Log</h2>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-zinc-50 transition-all">
            <Calendar size={16} /> Last 7 Days
          </button>
          <button className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-zinc-800 transition-all">
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Transaction</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Quantity</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {movements.map((m) => (
                <tr key={m.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-zinc-900">{m.id}</p>
                    <p className="text-[10px] text-zinc-400">{m.date}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-zinc-900">{m.name}</p>
                    <p className="text-xs text-zinc-500">{m.sku}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1 w-fit",
                      m.type === 'grn' || m.type === 'inward' ? "bg-emerald-50 text-emerald-600" : 
                      m.type === 'outward' || m.type === 'adjustment' ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600"
                    )}>
                      {m.type === 'grn' ? <ArrowDownLeft size={12} /> : 
                       m.type === 'transfer' ? <ArrowLeftRight size={12} /> : 
                       m.type === 'adjustment' ? <Filter size={12} /> : <ArrowUpRight size={12} />}
                      {m.type}
                    </span>
                  </td>
                  <td className={cn(
                    "px-6 py-4 font-mono font-bold",
                    m.qty > 0 ? "text-emerald-600" : "text-rose-600"
                  )}>
                    {m.qty > 0 ? `+${m.qty}` : m.qty}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-500">{m.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const InvoiceView = ({ order, onBack }: { order: any, onBack: () => void }) => {
  const gstRate = 18;
  const taxableValue = order.amount / (1 + gstRate / 100);
  const gstAmount = order.amount - taxableValue;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-4xl mx-auto bg-white p-8 md:p-12 rounded-[2.5rem] border border-zinc-200 shadow-2xl relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-50 rounded-full -mr-32 -mt-32 z-0" />
      
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="text-zinc-900" size={32} />
              <h1 className="text-3xl font-black tracking-tighter">DMS PRO</h1>
            </div>
            <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Tax Invoice</p>
          </div>
          <button onClick={onBack} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-12 mb-12">
          <div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Billed To</p>
            <h2 className="text-xl font-bold text-zinc-900">{order.customer}</h2>
            <p className="text-sm text-zinc-500 mt-1">GSTIN: 27AAACR1234A1Z5</p>
            <p className="text-sm text-zinc-500">Mumbai, Maharashtra, India</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Invoice Details</p>
            <p className="text-sm font-bold">Invoice #: INV-{order.id}</p>
            <p className="text-sm text-zinc-500">Date: {order.date}</p>
            <p className="text-sm text-zinc-500">Place of Supply: Maharashtra (27)</p>
          </div>
        </div>

        <div className="border-y border-zinc-100 py-6 mb-12">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                <th className="pb-4">Description</th>
                <th className="pb-4 text-right">Qty</th>
                <th className="pb-4 text-right">Rate</th>
                <th className="pb-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-zinc-50">
              <tr>
                <td className="py-4 font-bold text-zinc-900">FMCG Assorted Products</td>
                <td className="py-4 text-right">1 Case</td>
                <td className="py-4 text-right">₹{taxableValue.toFixed(2)}</td>
                <td className="py-4 text-right">₹{taxableValue.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <div className="w-full max-w-xs space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Taxable Value</span>
              <span className="font-bold">₹{taxableValue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">CGST (9%)</span>
              <span className="font-bold">₹{(gstAmount / 2).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">SGST (9%)</span>
              <span className="font-bold">₹{(gstAmount / 2).toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-4 border-t border-zinc-100">
              <span className="text-lg font-bold">Total Amount</span>
              <span className="text-2xl font-black">₹{order.amount.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-12 border-t border-zinc-100 flex justify-between items-end">
          <div className="text-[10px] text-zinc-400 max-w-xs">
            <p className="font-bold uppercase mb-1">Terms & Conditions</p>
            <p>Goods once sold will not be taken back. Interest @18% p.a. will be charged if payment is not made within 7 days.</p>
          </div>
          <button className="px-8 py-4 bg-zinc-900 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-200">
            <Download size={18} /> Download PDF
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const AnalyticsView = () => {
  const reps: any[] = [];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {reps.map((rep, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center text-white font-black">
                {rep.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-lg">{rep.name}</h3>
                <p className="text-xs text-zinc-500">Sales Representative</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-zinc-500 font-medium">Target Achievement</span>
                  <span className="font-bold">{(rep.sales / rep.target * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full bg-zinc-100 h-3 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((rep.sales / rep.target * 100), 100)}%` }}
                    className={cn(
                      "h-full transition-all",
                      rep.sales >= rep.target ? "bg-emerald-500" : "bg-zinc-900"
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 text-center">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Total Sales</p>
                  <p className="text-lg font-black">₹{(rep.sales / 1000).toFixed(0)}K</p>
                </div>
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 text-center">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Conversion</p>
                  <p className="text-lg font-black">{rep.conversion}%</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
                <div className="flex items-center gap-2 text-zinc-500">
                  <MapPin size={14} />
                  <span className="text-xs font-medium">{rep.visits} Visits</span>
                </div>
                <button 
                  onClick={() => toast.info('Detailed report view is being generated...')}
                  className="text-zinc-900 font-bold text-xs hover:underline"
                >
                  View Report
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-zinc-900 text-white p-10 rounded-[3rem] shadow-2xl shadow-zinc-200 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -mr-48 -mt-48" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div>
            <h2 className="text-3xl font-black mb-2">Team Performance Overview</h2>
            <p className="text-zinc-400">Monthly sales target is on track to be exceeded by 12%.</p>
          </div>
          <div className="flex gap-4">
            <div className="text-center px-8 py-4 bg-white/10 rounded-3xl backdrop-blur-md">
              <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Avg Conversion</p>
              <p className="text-3xl font-black">81.6%</p>
            </div>
            <div className="text-center px-8 py-4 bg-white/10 rounded-3xl backdrop-blur-md">
              <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Total Reach</p>
              <p className="text-3xl font-black">425</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ProductDetailView = ({ product, onBack, onUpdateStock }: { product: any, onBack: () => void, onUpdateStock: (sku: string, newStock: number, batchData?: any) => void }) => {
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  const handleDownloadPriceList = () => {
    const headers = ['SKU', 'Product Name', 'Brand', 'MRP', 'PTR', 'PTS'];
    const row = [product.sku, product.name, product.brand, product.mrp || (product.ptr * 1.2).toFixed(0), product.ptr, product.pts || (product.ptr * 0.92).toFixed(0)];
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + row.join(",");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${product.sku}_price_list.csv`);
    document.body.appendChild(link);
    link.click();
    toast.success('Price list downloaded successfully');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      <StockUpdateModal 
        isOpen={isUpdateModalOpen} 
        onClose={() => setIsUpdateModalOpen(false)} 
        product={product}
        onUpdate={(newStock, batchData) => onUpdateStock(product.sku, newStock, batchData)}
      />
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
        >
          <X size={24} className="text-zinc-600" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">{product.name}</h2>
          <p className="text-zinc-500 font-mono text-sm">{product.sku}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Info & Description */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-[2rem] border border-zinc-200 shadow-sm">
            <div className="flex flex-col md:flex-row gap-8 mb-8">
              <div className="w-full md:w-48 h-48 bg-zinc-100 rounded-3xl flex items-center justify-center shrink-0 overflow-hidden border border-zinc-100">
                <img 
                  src={`https://picsum.photos/seed/${product.sku}/400/400`} 
                  alt={product.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold">Product Description</h3>
                  <div className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                    product.isActive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                  )}>
                    {product.isActive ? 'Active' : 'Discontinued'}
                  </div>
                </div>
                <p className="text-zinc-600 leading-relaxed">
                  {product.description || "High-quality FMCG product from " + product.brand + ". This SKU is a core part of the distribution line, known for its consistent demand and reliable performance in both retail and wholesale segments."}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-8 border-t border-zinc-100">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Brand</p>
                <span className={cn(
                  "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                  product.brand === 'HUL' ? "bg-blue-50 text-blue-600" : 
                  product.brand === 'ITC' ? "bg-orange-50 text-orange-600" : "bg-zinc-100 text-zinc-600"
                )}>
                  {product.brand}
                </span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Category</p>
                <p className="text-sm font-bold text-zinc-900">{product.category}</p>
                <p className="text-[10px] text-zinc-500">{product.subCategory}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Variant / Size</p>
                <p className="text-sm font-bold text-zinc-900">{product.variant || 'Standard'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">HSN Code</p>
                <p className="text-sm font-bold text-zinc-900">{product.hsn || '34011110'}</p>
                <p className="text-[10px] text-zinc-500">GST: {product.gstRate}%</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-zinc-50">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Case Size</p>
                <p className="text-sm font-bold text-zinc-900">{product.caseSize} Units</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Min Order Qty</p>
                <p className="text-sm font-bold text-zinc-900">{product.moq} Units</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Shelf Life</p>
                <p className="text-sm font-bold text-zinc-900">{product.shelfLife}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Barcode / EAN</p>
                <p className="text-sm font-mono font-bold text-zinc-900">{product.barcode}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2rem] border border-zinc-200 shadow-sm">
            <h3 className="text-lg font-bold mb-6">Location-wise Stock Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['Main Warehouse', 'Secondary Godown', 'Sales Van 01'].map(loc => {
                const locStock = product.batches?.filter((b: any) => b.location === loc).reduce((acc: number, b: any) => acc + b.qty, 0) || 0;
                return (
                  <div key={loc} className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">{loc}</p>
                    <p className="text-xl font-black text-zinc-900">{locStock} Units</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2rem] border border-zinc-200 shadow-sm">
            <h3 className="text-lg font-bold mb-6">Batch & Expiry Tracking</h3>
            <div className="space-y-4">
              {product.batches?.map((batch: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-zinc-400">
                      <Package size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-zinc-900">{batch.number || batch.batchNumber}</p>
                      <p className="text-xs text-zinc-500 flex items-center gap-1">
                        <Calendar size={12} /> Expires: {batch.expiry || batch.expiryDate} | <MapPin size={12} /> {batch.location}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-zinc-900">{batch.qty}</p>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase">Units</p>
                  </div>
                </div>
              ))}
              {(!product.batches || product.batches.length === 0) && (
                <p className="text-sm text-zinc-500 text-center py-4">No batch information available</p>
              )}
            </div>
          </div>

          {product.isSerialized && (
            <div className="bg-white p-8 rounded-[2rem] border border-zinc-200 shadow-sm">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <ShieldCheck className="text-emerald-600" size={20} />
                Serialized Tracking (High-Value SKU)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {product.serialNumbers?.map((sn: string) => (
                  <div key={sn} className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-mono font-bold text-emerald-700">
                    {sn}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-zinc-400 mt-4 italic">* Serial numbers are tracked for warranty and high-value reconciliation.</p>
            </div>
          )}

          <div className="bg-white p-8 rounded-[2rem] border border-zinc-200 shadow-sm">
            <h3 className="text-lg font-bold mb-6">Pricing Variants</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { label: 'MRP (Maximum Retail Price)', value: product.mrp || (product.ptr * 1.2).toFixed(0), sub: 'Inclusive of all taxes' },
                { label: 'PTR (Price to Retailer)', value: product.ptr, sub: 'Standard billing price' },
                { label: 'PTS (Price to Stockist)', value: product.pts || (product.ptr * 0.92).toFixed(0), sub: 'Distributor landing cost' },
                { label: 'Distributor Price', value: product.distributorPrice || (product.ptr * 0.95).toFixed(0), sub: 'Internal transfer price' },
                { label: 'Wholesaler Price', value: product.wholesalerPrice, sub: 'Bulk purchase rate' },
                { label: 'Retailer Price', value: product.retailerPrice, sub: 'Direct retail rate' },
              ].map((price, i) => (
                <div key={i} className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                  <p className="text-xs font-bold text-zinc-500 mb-1">{price.label}</p>
                  <p className="text-2xl font-black text-zinc-900">₹{price.value}</p>
                  <p className="text-[10px] text-zinc-400 mt-1">{price.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Stock & Actions */}
        <div className="space-y-6">
          <div className="bg-zinc-900 text-white p-8 rounded-[2rem] shadow-xl shadow-zinc-200">
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                <Package size={24} />
              </div>
              {product.stock < 50 && (
                <span className="px-3 py-1 bg-rose-500 text-white text-[10px] font-bold rounded-full uppercase">Critical</span>
              )}
            </div>
            <p className="text-zinc-400 text-sm font-medium">Current Inventory</p>
            <p className="text-5xl font-black mb-2">{product.stock}</p>
            <p className="text-xs text-zinc-500">Units available in Main Warehouse</p>
            
            <div className="mt-8 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Reorder Level</span>
                <span className="font-bold">{product.reorderLevel || 100} Units</span>
              </div>
              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all",
                    product.stock < 50 ? "bg-rose-500" : "bg-emerald-500"
                  )}
                  style={{ width: `${Math.min((product.stock / (product.reorderLevel || 100)) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-zinc-200 shadow-sm space-y-3">
            <button 
              onClick={() => setIsUpdateModalOpen(true)}
              className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all"
            >
              Update Stock
            </button>
            <button 
              onClick={handleDownloadPriceList}
              className="w-full py-4 bg-zinc-50 text-zinc-900 border border-zinc-100 rounded-2xl font-bold hover:bg-zinc-100 transition-all flex items-center justify-center gap-2"
            >
              <Download size={18} />
              Download Price List
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const ReorderSuggestions = ({ products }: { products: any[] }) => {
  const lowStockProducts = products.filter(p => p.stock <= (p.reorderLevel || 100));

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold">Auto-Reorder Suggestions</h3>
          <p className="text-sm text-zinc-500">Products currently below minimum stock levels</p>
        </div>
        <button 
          onClick={() => toast.success('Purchase orders generated for all items')}
          className="bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2"
        >
          <ShoppingCart size={18} /> Order All
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100">
              <th className="pb-4">Product</th>
              <th className="pb-4">Current Stock</th>
              <th className="pb-4">Min Level</th>
              <th className="pb-4">Suggested Order</th>
              <th className="pb-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {lowStockProducts.map(p => (
              <tr key={p.sku} className="text-sm">
                <td className="py-4 font-bold">{p.name}</td>
                <td className="py-4 text-rose-600 font-black">{p.stock}</td>
                <td className="py-4 text-zinc-500">{p.reorderLevel || 100}</td>
                <td className="py-4 font-bold text-emerald-600">{(p.reorderLevel || 100) * 2 - p.stock} Units</td>
                <td className="py-4 text-right">
                  <button className="text-zinc-900 font-bold hover:underline">Create PO</button>
                </td>
              </tr>
            ))}
            {lowStockProducts.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-zinc-500">All products are above reorder levels.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const InventoryView = ({ products, onUpdateStock, onAddProduct, companies }: { products: any[], onUpdateStock: (sku: string, qty: number, batch?: any) => void, onAddProduct: (p: any) => void, companies: any[] }) => {
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'reorder'>('list');

  const fuse = new Fuse(products, {
    keys: ['name', 'sku', 'brand', 'category'],
    threshold: 0.3
  });

  const filteredProducts = searchQuery 
    ? fuse.search(searchQuery).map(r => r.item)
    : products;

  const finalProducts = selectedBrand === 'All' 
    ? filteredProducts 
    : filteredProducts.filter(p => p.brand === selectedBrand);

  const handleLocalUpdateStock = (sku: string, newTotalStock: number, batchData?: any) => {
    const currentProduct = products.find(p => p.sku === sku);
    if (currentProduct) {
      const qtyChange = newTotalStock - currentProduct.stock;
      onUpdateStock(sku, qtyChange, batchData);
      
      if (selectedProduct && selectedProduct.sku === sku) {
        setSelectedProduct({ ...currentProduct, stock: newTotalStock, batches: [...(currentProduct.batches || []), ...(batchData ? [batchData] : [])] });
      }
    }
  };

  if (selectedProduct) {
    return (
      <ProductDetailView 
        product={selectedProduct} 
        onBack={() => setSelectedProduct(null)} 
        onUpdateStock={handleLocalUpdateStock}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 p-1 bg-zinc-100 rounded-2xl w-fit">
        {[
          { id: 'list', label: 'Product List', icon: Package },
          { id: 'reorder', label: 'Reorder Suggestions', icon: ShoppingCart },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all",
              activeSubTab === tab.id ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'reorder' ? (
        <ReorderSuggestions products={products} />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <div className="flex flex-1 gap-2 w-full max-w-2xl">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Fuzzy search SKUs, Brands, or Names..." 
                  className="w-full pl-10 pr-4 py-3 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                <select 
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="pl-10 pr-8 py-3 bg-white border border-zinc-200 rounded-2xl appearance-none focus:ring-2 focus:ring-zinc-900 outline-none transition-all font-bold text-sm"
                >
                  <option>All</option>
                  <option>HUL</option>
                  <option>ITC</option>
                  <option>Amul</option>
                  <option>Britannia</option>
                </select>
              </div>
            </div>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 w-full md:w-auto justify-center"
            >
              <PlusCircle size={18} />
              Add Product
            </button>
          </div>

          <AddProductModal 
            isOpen={isAddModalOpen} 
            onClose={() => setIsAddModalOpen(false)} 
            companies={companies}
            onAdd={(newProduct) => {
              onAddProduct(newProduct);
              setIsAddModalOpen(false);
              toast.success('Product added successfully');
            }}
          />

          <div className="bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Brand</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Stock</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Price (PTR)</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {finalProducts.map((p) => (
                    <tr 
                      key={p.sku} 
                      className="hover:bg-zinc-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedProduct(p)}
                    >
                      <td className="px-6 py-4">
                        <p className="font-bold text-zinc-900">{p.name}</p>
                        <p className="text-xs text-zinc-500">{p.sku}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                          p.brand === 'HUL' ? "bg-blue-50 text-blue-600" : 
                          p.brand === 'ITC' ? "bg-orange-50 text-orange-600" : "bg-zinc-100 text-zinc-600"
                        )}>
                          {p.brand}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold">{p.stock}</td>
                      <td className="px-6 py-4">₹{p.ptr}</td>
                      <td className="px-6 py-4">
                        {p.stock < (p.reorderLevel || 100) ? (
                          <span className="flex items-center gap-1 text-rose-600 font-bold text-xs">
                            <AlertCircle size={14} /> Low Stock
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-bold text-xs">In Stock</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {finalProducts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                        No products found matching your criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ApprovalsView = ({ orders }: { orders: any[] }) => {
  const pendingApprovals = orders.filter(o => o.status === 'Pending' || o.workflow === 'Pending Approval');
  const [approvals, setApprovals] = useState<any[]>([]);

  const handleAction = (id: string, action: 'Approved' | 'Rejected') => {
    toast.success(`Request ${id} ${action} successfully`);
    setApprovals(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Pending Approvals</h2>
          <p className="text-sm text-zinc-500">Review and authorize flagged transactions</p>
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-xs font-bold">{approvals.length} Pending</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {approvals.map(a => (
          <div key={a.id} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm flex flex-col md:flex-row justify-between gap-6">
            <div className="flex-1 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="px-2 py-1 bg-zinc-100 rounded-lg text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2 inline-block">
                    {a.id}
                  </span>
                  <h3 className="text-lg font-bold text-zinc-900">{a.type}</h3>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-400">Requested Amount</p>
                  <p className="text-xl font-black text-zinc-900">₹{a.amount.toLocaleString()}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4 border-y border-zinc-50">
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase">Customer</p>
                  <p className="text-sm font-bold">{a.customer}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase">Requested By</p>
                  <p className="text-sm font-bold">{a.requestedBy}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase">Date</p>
                  <p className="text-sm font-bold">{a.date}</p>
                </div>
              </div>

              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Justification</p>
                <p className="text-sm text-zinc-600 italic">"{a.reason}"</p>
              </div>
            </div>

            <div className="flex md:flex-col gap-2 justify-end min-w-[160px]">
              <button 
                onClick={() => handleAction(a.id, 'Approved')}
                className="flex-1 py-3 bg-zinc-900 text-white rounded-2xl text-sm font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
              >
                <ShieldCheck size={18} /> Approve
              </button>
              <button 
                onClick={() => handleAction(a.id, 'Rejected')}
                className="flex-1 py-3 bg-white text-rose-600 border border-rose-100 rounded-2xl text-sm font-bold hover:bg-rose-50 transition-all flex items-center justify-center gap-2"
              >
                <X size={18} /> Reject
              </button>
            </div>
          </div>
        ))}
        {approvals.length === 0 && (
          <div className="bg-white p-12 rounded-[3rem] border border-zinc-200 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <ShieldCheck size={32} />
            </div>
            <h3 className="text-xl font-bold">All caught up!</h3>
            <p className="text-zinc-500">No pending approvals at the moment.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const OrdersView = ({ orders, products, onAddOrder, onCancelOrder }: { orders: any[], products: any[], onAddOrder: (o: any) => void, onCancelOrder: (id: string) => void }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All Orders');

  const fuse = new Fuse(orders, {
    keys: ['id', 'customer', 'status'],
    threshold: 0.3
  });

  const filteredOrders = searchQuery 
    ? fuse.search(searchQuery).map(r => r.item)
    : orders;

  const finalOrders = selectedStatus === 'All Orders' 
    ? filteredOrders 
    : filteredOrders.filter(o => o.status === selectedStatus);

  if (selectedOrder) {
    return <InvoiceView order={selectedOrder} onBack={() => setSelectedOrder(null)} />;
  }

  return (
    <div className="space-y-6">
      <QuickOrderModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        products={products}
        onAddOrder={onAddOrder}
      />
      
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div className="flex flex-1 gap-2 w-full max-w-3xl overflow-x-auto pb-2 scrollbar-hide">
          {['All Orders', 'Pending', 'On Hold', 'Dispatched', 'Delivered', 'Cancelled'].map((status) => (
            <button 
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={cn(
                "px-6 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all",
                selectedStatus === status ? "bg-zinc-900 text-white" : "bg-white border border-zinc-200 text-zinc-500 hover:border-zinc-900"
              )}
            >
              {status}
            </button>
          ))}
        </div>
        <div className="flex gap-2 w-full xl:w-auto">
          <div className="relative flex-1 xl:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search orders..." 
              className="w-full pl-10 pr-4 py-3 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
            />
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-zinc-200 shrink-0"
          >
            <ShoppingCart size={18} />
            New Order
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {finalOrders.map((order) => (
          <motion.div 
            key={order.id}
            whileHover={{ y: -2 }}
            className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm flex flex-col gap-4"
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{order.id}</p>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-zinc-100 text-zinc-500 rounded uppercase">{order.channel}</span>
                </div>
                <h3 className="text-lg font-bold text-zinc-900">{order.customer}</h3>
              </div>
              <span className={cn(
                "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                order.status === 'Delivered' ? "bg-emerald-50 text-emerald-600" :
                order.status === 'Pending' ? "bg-amber-50 text-amber-600" : 
                order.status === 'On Hold' ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600"
              )}>
                {order.status}
              </span>
            </div>

            <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
              <div className="flex justify-between items-center mb-2">
                <p className="text-[10px] font-bold text-zinc-400 uppercase">Workflow Stage</p>
                <p className="text-[10px] font-bold text-zinc-900">{order.workflow}</p>
              </div>
              <div className="w-full bg-zinc-200 h-1.5 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all",
                    order.status === 'On Hold' ? "bg-rose-500" : "bg-zinc-900"
                  )}
                  style={{ width: order.workflow === 'Completed' ? '100%' : order.workflow === 'In Transit' ? '75%' : '25%' }}
                />
              </div>
            </div>

            <div className="flex justify-between items-end mt-2">
              <div>
                <p className="text-xs text-zinc-500">Order Date</p>
                <p className="font-semibold">{order.date}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-500">Total Amount</p>
                <p className="text-xl font-black text-zinc-900">₹{order.amount.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setSelectedOrder(order)}
                className="flex-1 py-3 bg-zinc-50 text-zinc-900 rounded-2xl text-sm font-bold hover:bg-zinc-100 transition-all border border-zinc-100"
              >
                View Details
              </button>
              <button 
                onClick={() => setSelectedOrder(order)}
                className="flex-1 py-3 bg-zinc-900 text-white rounded-2xl text-sm font-bold hover:bg-zinc-800 transition-all"
              >
                Generate Invoice
              </button>
              {order.status !== 'Cancelled' && order.status !== 'Delivered' && (
                <button 
                  onClick={() => {
                    if (window.confirm('Are you sure you want to cancel this order? Stock will be reversed.')) {
                      onCancelOrder(order.id);
                    }
                  }}
                  className="px-4 py-3 bg-rose-50 text-rose-600 rounded-2xl text-sm font-bold hover:bg-rose-100 transition-all border border-rose-100"
                >
                  Cancel
                </button>
              )}
            </div>
          </motion.div>
        ))}
        {finalOrders.length === 0 && (
          <div className="col-span-full py-12 text-center text-zinc-500">
            No orders found matching your criteria.
          </div>
        )}
      </div>
    </div>
  );
};

const CustomerDetailView = ({ customer, onBack }: { customer: any, onBack: () => void }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
          <ArrowLeftRight size={24} className="text-zinc-600 rotate-180" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">{customer.name}</h2>
          <p className="text-zinc-500 font-mono text-sm">{customer.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-[2rem] border border-zinc-200 shadow-sm">
            <h3 className="text-lg font-bold mb-6">Business Information</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Owner Name</p>
                <p className="font-bold">{customer.ownerName}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Customer Type</p>
                <span className="px-2 py-1 bg-zinc-100 rounded-lg text-[10px] font-bold text-zinc-600 uppercase">
                  {customer.type}
                </span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">KYC Status</p>
                <span className={cn(
                  "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                  customer.kycStatus === 'Verified' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                )}>
                  {customer.kycStatus}
                </span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">GST Number</p>
                <p className="font-mono font-bold">{customer.gstNumber}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">PAN Number</p>
                <p className="font-mono font-bold">{customer.pan}</p>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-zinc-50 space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="text-zinc-400 mt-1" size={18} />
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Address & GPS</p>
                  <p className="text-sm text-zinc-600">{customer.address}</p>
                  <p className="text-xs font-mono text-blue-600 mt-1">{customer.gps}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2rem] border border-zinc-200 shadow-sm">
            <h3 className="text-lg font-bold mb-6">Credit & Payment Terms</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Credit Limit</p>
                <p className="text-xl font-black">₹{customer.limit.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Credit Period</p>
                <p className="font-bold">{customer.creditPeriod} Days</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Payment Terms</p>
                <p className="font-bold">{customer.paymentTerms}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Outstanding</p>
                <p className={cn("text-xl font-black", customer.outstanding > 0 ? "text-rose-600" : "text-emerald-600")}>
                  ₹{customer.outstanding.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2rem] border border-zinc-200 shadow-sm">
            <h3 className="text-lg font-bold mb-6">Principal-specific Codes</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(customer.codes || {}).map(([brand, code]) => (
                <div key={brand} className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">{brand}</p>
                  <p className="font-bold text-zinc-900">{code as string}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-zinc-900 text-white p-8 rounded-[2rem] shadow-xl shadow-zinc-200">
            <h3 className="text-lg font-bold mb-6">Route & Sales Mapping</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400 text-sm">Beat</span>
                <span className="font-bold">{customer.beat}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400 text-sm">Route</span>
                <span className="font-bold">{customer.route}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400 text-sm">Sales Rep</span>
                <span className="font-bold">{customer.salesRep}</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2rem] border border-zinc-200 shadow-sm">
            <h3 className="text-lg font-bold mb-4">Bank Details</h3>
            <p className="text-sm font-mono text-zinc-600 bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
              {customer.bankDetails}
            </p>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-zinc-200 shadow-sm space-y-3">
            <button className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2">
              <FileText size={18} /> View KYC Docs
            </button>
            <button className="w-full py-4 bg-zinc-50 text-zinc-900 border border-zinc-100 rounded-2xl font-bold hover:bg-zinc-100 transition-all">
              Edit Profile
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const CustomersView = ({ customers, setCustomers }: { customers: any[], setCustomers: React.Dispatch<React.SetStateAction<any[]>> }) => {
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');

  const fuse = new Fuse(customers, {
    keys: ['name', 'id', 'beat'],
    threshold: 0.3
  });

  const filteredCustomers = searchQuery 
    ? fuse.search(searchQuery).map(r => r.item)
    : customers;

  const finalCustomers = selectedType === 'All' 
    ? filteredCustomers 
    : filteredCustomers.filter(c => c.type === selectedType);

  if (selectedCustomer) {
    return <CustomerDetailView customer={selectedCustomer} onBack={() => setSelectedCustomer(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="flex flex-1 gap-2 w-full max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Fuzzy search customers..." 
              className="w-full pl-10 pr-4 py-3 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <select 
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="pl-10 pr-8 py-3 bg-white border border-zinc-200 rounded-2xl appearance-none focus:ring-2 focus:ring-zinc-900 outline-none transition-all font-bold text-sm"
            >
              <option>All</option>
              <option>Retailer</option>
              <option>Wholesaler</option>
            </select>
          </div>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 w-full md:w-auto justify-center"
        >
          <Plus size={18} />
          Add Customer
        </button>
      </div>

      <AddCustomerModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onAdd={(newCustomer) => {
          setCustomers(prev => [newCustomer, ...prev]);
          setIsAddModalOpen(false);
          toast.success('Customer added successfully');
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {finalCustomers.map((c) => (
          <div 
            key={c.id} 
            onClick={() => setSelectedCustomer(c)}
            className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm cursor-pointer hover:border-zinc-900 transition-all"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-600">
                <Users size={24} />
              </div>
              <span className="px-2 py-1 bg-zinc-100 rounded-lg text-[10px] font-bold text-zinc-600 uppercase">
                {c.type}
              </span>
            </div>
            <h3 className="text-lg font-bold text-zinc-900 mb-1">{c.name}</h3>
            <p className="text-sm text-zinc-500 mb-4 flex items-center gap-1">
              <MapPin size={14} /> {c.beat}
            </p>
            
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Outstanding</span>
                <span className={cn("font-bold", c.outstanding > 0 ? "text-rose-600" : "text-emerald-600")}>
                  ₹{c.outstanding.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-zinc-900 h-full transition-all" 
                  style={{ width: `${(c.outstanding / c.limit) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase">
                <span>Credit Limit</span>
                <span>₹{c.limit.toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
        {finalCustomers.length === 0 && (
          <div className="col-span-full py-12 text-center text-zinc-500">
            No customers found matching your criteria.
          </div>
        )}
      </div>
    </div>
  );
};

const SupplierView = ({ suppliers, setSuppliers }: { suppliers: any[], setSuppliers: React.Dispatch<React.SetStateAction<any[]>> }) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-zinc-900">Suppliers</h2>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2"
        >
          <Plus size={18} /> Add Supplier
        </button>
      </div>

      <AddSupplierModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onAdd={(newSupplier) => {
          setSuppliers(prev => [newSupplier, ...prev]);
          setIsAddModalOpen(false);
          toast.success('Supplier added successfully');
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {suppliers.map(s => (
          <div key={s.id} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-600 font-black">
                {s.code}
              </div>
              <span className="px-2 py-1 bg-zinc-100 rounded-lg text-[10px] font-bold text-zinc-600 uppercase">
                {s.type}
              </span>
            </div>
            <h3 className="text-lg font-bold text-zinc-900 mb-1">{s.name}</h3>
            <p className="text-xs text-zinc-500 mb-4">GSTIN: {s.gstin}</p>
            
            <div className="space-y-3 pt-4 border-t border-zinc-50">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Depot Code</span>
                <span className="font-bold">{s.depot}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">ASM Name</span>
                <span className="font-bold">{s.asm}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Contact</span>
                <span className="font-bold">{s.contact}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AddCompanyModal = ({ isOpen, onClose, onAdd }: { isOpen: boolean, onClose: () => void, onAdd: (c: any) => void }) => {
  const [formData, setFormData] = useState({
    name: '', code: '', type: 'Principal', status: 'Active'
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4">
        <h3 className="text-lg font-bold">Add New Company</h3>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase">Company Name</label>
            <input 
              type="text" 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none" 
              placeholder="e.g. Nestle India"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase">Company Code</label>
            <input 
              type="text" 
              value={formData.code} 
              onChange={e => setFormData({...formData, code: e.target.value})}
              className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none" 
              placeholder="e.g. NSTL"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase">Type</label>
            <select 
              value={formData.type} 
              onChange={e => setFormData({...formData, type: e.target.value})}
              className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none font-bold"
            >
              <option>Principal</option>
              <option>Distribution Node</option>
              <option>Third Party</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 pt-4">
          <button onClick={onClose} className="flex-1 py-3 bg-zinc-100 rounded-xl font-bold">Cancel</button>
          <button 
            onClick={() => {
              if (!formData.name || !formData.code) {
                toast.error('Please fill all fields');
                return;
              }
              onAdd({ ...formData, id: `COMP-${Math.floor(Math.random() * 1000)}` });
            }} 
            className="flex-1 py-3 bg-zinc-900 text-white rounded-xl font-bold"
          >
            Add Company
          </button>
        </div>
      </div>
    </div>
  );
};

const CompanyView = ({ companies, setCompanies }: { companies: any[], setCompanies: React.Dispatch<React.SetStateAction<any[]>> }) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Companies</h2>
          <p className="text-sm text-zinc-500">Manage principals and distribution entities</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-zinc-200"
        >
          <Plus size={18} /> Add Company
        </button>
      </div>

      <AddCompanyModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onAdd={(newCompany) => {
          setCompanies(prev => [newCompany, ...prev]);
          setIsAddModalOpen(false);
          toast.success('Company added successfully');
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {companies.map(company => (
          <div key={company.id} className="bg-white p-6 rounded-[2rem] border border-zinc-200 shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center mb-4">
              <Building2 className="text-zinc-600" size={24} />
            </div>
            <h3 className="font-bold text-zinc-900 mb-1">{company.name}</h3>
            <div className="flex items-center justify-between mt-4">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{company.code}</span>
              <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-bold uppercase">
                {company.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900 text-white p-8 rounded-[2.5rem] shadow-xl">
        <h3 className="text-lg font-bold mb-4">Multi-Company Configuration</h3>
        <p className="text-sm text-zinc-400 mb-6">Configure global settings for new principals and distribution nodes.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
            <p className="text-xs font-bold text-zinc-500 uppercase mb-2">Default Currency</p>
            <p className="text-sm font-bold">INR (₹) - Indian Rupee</p>
          </div>
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
            <p className="text-xs font-bold text-zinc-500 uppercase mb-2">Tax System</p>
            <p className="text-sm font-bold">GST (Goods and Services Tax)</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const GeographicView = () => {
  const [activeSubTab, setActiveSubTab] = useState<'hierarchy' | 'journey'>('hierarchy');
  
  const hierarchy = [
    { state: 'Maharashtra', district: 'Mumbai City', city: 'Mumbai', area: 'Andheri East', beat: 'Beat 01', route: 'Marol-SakiNaka' },
    { state: 'Maharashtra', district: 'Mumbai City', city: 'Mumbai', area: 'Borivali West', beat: 'Beat 04', route: 'Link Road' },
  ];

  const journeyPlan = [
    { day: 'Monday', route: 'Marol-SakiNaka', rep: 'Rahul Sharma', outlets: 24 },
    { day: 'Tuesday', route: 'Powai-Vihar', rep: 'Rahul Sharma', outlets: 18 },
    { day: 'Wednesday', route: 'Link Road', rep: 'Amit Patel', outlets: 30 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-zinc-900">Geographic Hierarchy</h2>
        <button 
          onClick={() => toast.info('Add Geo Node feature coming soon')}
          className="bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2"
        >
          <Plus size={18} /> Add Geo Node
        </button>
      </div>

      <div className="flex gap-2 p-1 bg-zinc-100 rounded-2xl w-fit">
        {[
          { id: 'hierarchy', label: 'Geo Hierarchy', icon: MapPin },
          { id: 'journey', label: 'Journey Plan', icon: Calendar },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all",
              activeSubTab === tab.id ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'hierarchy' && (
        <div className="bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">State/District</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">City/Area</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Beat/Route</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">GPS Boundary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {hierarchy.map((h, i) => (
                <tr key={i} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-zinc-900">{h.state}</p>
                    <p className="text-xs text-zinc-500">{h.district}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-zinc-900">{h.city}</p>
                    <p className="text-xs text-zinc-500">{h.area}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-zinc-900">{h.beat}</p>
                    <p className="text-xs text-zinc-500">{h.route}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => toast.info(`Viewing GPS boundary for ${h.route}`)}
                      className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 justify-end"
                    >
                      <MapPin size={12} /> View Polygon
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeSubTab === 'journey' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {journeyPlan.map((j, i) => (
            <div key={i} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <span className="px-3 py-1 bg-zinc-900 text-white rounded-full text-[10px] font-bold uppercase tracking-widest">
                  {j.day}
                </span>
                <Clock size={16} className="text-zinc-400" />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 mb-1">{j.route}</h3>
              <p className="text-sm text-zinc-500 mb-4">Rep: {j.rep}</p>
              <div className="flex justify-between items-center pt-4 border-t border-zinc-50">
                <span className="text-xs font-bold text-zinc-400 uppercase">Target Outlets</span>
                <span className="text-xl font-black text-zinc-900">{j.outlets}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SalesRepMobileView = ({ onRecordPayment, customers, products }: { onRecordPayment: (p: any) => void, customers: any[], products: any[] }) => {
  const [activeTab, setActiveTab] = useState<'beat' | 'orders' | 'performance' | 'more'>('beat');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [mobileView, setMobileView] = useState<'menu' | 'order' | 'no-order' | 'competitor' | 'photo' | 'expense' | 'attendance' | 'collection'>('menu');
  const [mobileCart, setMobileCart] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<{ status: 'out' | 'in', time: string | null }>({ status: 'out', time: null });
  const [isOnline, setIsOnline] = useState(true);
  const [paymentData, setPaymentData] = useState({ amount: '', mode: 'Cash', instrumentNo: '', bank: '', date: new Date().toISOString().split('T')[0] });
  
  const todayBeat = customers.slice(0, 3).map(c => ({
    ...c,
    status: c.outstanding > 0 ? 'Pending' : 'Visited',
    lastVisit: '3 days ago'
  }));

  const stats = {
    target: 50000,
    achieved: 32500,
    visits: { total: 15, completed: 8 },
    efficiency: 84
  };

  const addToMobileCart = (p: any) => {
    if (p.stock <= 0) {
      toast.error('Out of stock');
      return;
    }
    setMobileCart(prev => {
      const existing = prev.find(item => item.id === p.id);
      if (existing) return prev.map(item => item.id === p.id ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { ...p, qty: 1 }];
    });
  };

  const mobileTotal = mobileCart.reduce((acc, item) => acc + (item.price * item.qty), 0);

  const BottomNav = () => (
    <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-zinc-100 px-6 py-3 flex justify-between items-center z-50">
      {[
        { id: 'beat', icon: MapPin, label: 'Beat' },
        { id: 'orders', icon: ShoppingCart, label: 'Orders' },
        { id: 'performance', icon: TrendingUp, label: 'Stats' },
        { id: 'more', icon: Menu, label: 'More' },
      ].map(item => (
        <button 
          key={item.id}
          onClick={() => { setActiveTab(item.id as any); setSelectedCustomer(null); }}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            activeTab === item.id ? "text-zinc-900" : "text-zinc-400"
          )}
        >
          <item.icon size={20} strokeWidth={activeTab === item.id ? 2.5 : 2} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
        </button>
      ))}
    </div>
  );

  if (selectedCustomer) {
    return (
      <div className="flex flex-col h-[800px] bg-white max-w-md mx-auto border-x border-zinc-200 relative overflow-hidden rounded-[3rem] shadow-2xl">
        <div className="p-6 bg-white border-b border-zinc-100 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => { 
                if (mobileView !== 'menu') setMobileView('menu');
                else { setSelectedCustomer(null); setCheckedIn(false); }
              }} 
              className="w-10 h-10 bg-zinc-50 flex items-center justify-center rounded-full text-zinc-600"
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <h3 className="font-bold text-zinc-900 text-sm truncate w-40">{selectedCustomer.name}</h3>
              <div className="flex items-center gap-1.5">
                <div className={cn("w-1.5 h-1.5 rounded-full", isOnline ? "bg-emerald-500" : "bg-amber-500")} />
                <p className="text-[10px] text-zinc-400 font-bold uppercase">{isOnline ? 'Live Tracking' : 'Offline Mode'}</p>
              </div>
            </div>
          </div>
          <button className="w-10 h-10 bg-zinc-50 flex items-center justify-center rounded-full text-zinc-600">
            <MoreVertical size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-24">
          {!checkedIn ? (
            <div className="p-6 space-y-6">
              <div className="aspect-square bg-zinc-50 rounded-[2.5rem] flex flex-col items-center justify-center p-8 text-center space-y-4 border-2 border-dashed border-zinc-200">
                <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center text-zinc-900">
                  <MapPin size={32} />
                </div>
                <div>
                  <h4 className="text-xl font-bold">Check-in Required</h4>
                  <p className="text-sm text-zinc-500 mt-1">Please verify your location to start the visit activities.</p>
                </div>
              </div>
              
              <div className="bg-zinc-50 p-6 rounded-3xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                    <MapPin size={16} className="text-zinc-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase">Current Distance</p>
                    <p className="text-sm font-bold text-zinc-900">12 meters away</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => {
                  setCheckedIn(true);
                  toast.success('Check-in successful at ' + selectedCustomer.name);
                }}
                className="w-full py-5 bg-zinc-900 text-white rounded-[2rem] font-bold flex items-center justify-center gap-3 shadow-xl shadow-zinc-200 active:scale-95 transition-all"
              >
                <ShieldCheck size={20} />
                Confirm Check-in
              </button>
            </div>
          ) : mobileView === 'menu' ? (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { id: 'order', icon: ShoppingCart, label: 'Take Order', color: 'bg-zinc-900 text-white' },
                  { id: 'collection', icon: IndianRupee, label: 'Collection', color: 'bg-white text-zinc-900' },
                  { id: 'photo', icon: Camera, label: 'Shelf Photo', color: 'bg-white text-zinc-900' },
                  { id: 'competitor', icon: Eye, label: 'Competitor', color: 'bg-white text-zinc-900' },
                  { id: 'no-order', icon: AlertCircle, label: 'No Order', color: 'bg-white text-zinc-900' },
                  { id: 'expense', icon: TrendingUp, label: 'Expense', color: 'bg-white text-zinc-900' },
                ].map(action => (
                  <button 
                    key={action.id}
                    onClick={() => setMobileView(action.id as any)}
                    className={cn(
                      "p-6 rounded-[2rem] border border-zinc-100 flex flex-col items-center gap-3 shadow-sm transition-all active:scale-95",
                      action.color
                    )}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center",
                      action.id === 'order' ? "bg-white/20" : "bg-zinc-50"
                    )}>
                      <action.icon size={24} />
                    </div>
                    <span className="font-bold text-xs">{action.label}</span>
                  </button>
                ))}
              </div>

              <div className="bg-rose-50 p-6 rounded-[2.5rem] border border-rose-100 relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Outstanding Balance</span>
                    <span className="text-xl font-black text-rose-900">₹{selectedCustomer.outstanding.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-rose-500">
                    <AlertCircle size={14} />
                    <p className="text-[10px] font-bold uppercase">Overdue by 12 days</p>
                  </div>
                </div>
                <div className="absolute -right-4 -bottom-4 opacity-10 text-rose-900">
                  <IndianRupee size={100} />
                </div>
              </div>
            </div>
          ) : mobileView === 'order' ? (
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-xl font-bold">Catalog</h4>
                <div className="flex gap-2">
                  <button className="w-10 h-10 bg-zinc-50 rounded-full flex items-center justify-center"><Search size={18} /></button>
                  <button className="w-10 h-10 bg-zinc-50 rounded-full flex items-center justify-center"><Filter size={18} /></button>
                </div>
              </div>

              <div className="space-y-3">
                {products.map(p => (
                  <div key={p.id} className="bg-white p-4 rounded-3xl border border-zinc-100 flex items-center gap-4 shadow-sm">
                    <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-300">
                      <Package size={32} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-zinc-900 truncate">{p.name}</p>
                      <p className="text-xs text-zinc-500">₹{p.price} • Stock: {p.stock}</p>
                    </div>
                    <button 
                      onClick={() => addToMobileCart(p)}
                      className="w-10 h-10 bg-zinc-900 text-white rounded-xl flex items-center justify-center shadow-lg shadow-zinc-200 active:scale-90 transition-all"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                ))}
              </div>

              {mobileCart.length > 0 && (
                <motion.div 
                  initial={{ y: 100 }}
                  animate={{ y: 0 }}
                  className="fixed bottom-6 left-6 right-6 bg-zinc-900 text-white p-6 rounded-[2.5rem] shadow-2xl z-50 flex items-center justify-between"
                >
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase">Total Amount</p>
                    <p className="text-xl font-black">₹{mobileTotal.toLocaleString()}</p>
                  </div>
                  <button 
                    onClick={() => {
                      toast.success('Order placed successfully!');
                      setSelectedCustomer(null);
                      setCheckedIn(false);
                      setMobileView('menu');
                      setMobileCart([]);
                    }}
                    className="px-8 py-4 bg-emerald-500 text-white rounded-2xl font-bold shadow-lg shadow-emerald-900/20 active:scale-95 transition-all"
                  >
                    Checkout
                  </button>
                </motion.div>
              )}
            </div>
          ) : mobileView === 'collection' ? (
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-xl font-bold text-zinc-900">Record Payment</h4>
                <div className="px-3 py-1 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-bold uppercase">
                  Due: ₹{selectedCustomer.outstanding.toLocaleString()}
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Payment Amount</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <input 
                      type="number" 
                      value={paymentData.amount}
                      onChange={e => setPaymentData({...paymentData, amount: e.target.value})}
                      placeholder="0.00"
                      className="w-full pl-12 pr-4 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none font-black text-xl"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Payment Mode</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Cash', 'Cheque', 'Digital'].map(mode => (
                      <button 
                        key={mode}
                        onClick={() => setPaymentData({...paymentData, mode})}
                        className={cn(
                          "py-3 rounded-xl text-xs font-bold transition-all border",
                          paymentData.mode === mode ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-500 border-zinc-100"
                        )}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {paymentData.mode === 'Cheque' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">Cheque Number</label>
                      <input 
                        type="text" 
                        value={paymentData.instrumentNo}
                        onChange={e => setPaymentData({...paymentData, instrumentNo: e.target.value})}
                        className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none text-sm font-bold"
                        placeholder="6-digit number"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Bank Name</label>
                        <input 
                          type="text" 
                          value={paymentData.bank}
                          onChange={e => setPaymentData({...paymentData, bank: e.target.value})}
                          className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none text-sm font-bold"
                          placeholder="e.g. HDFC"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Cheque Date</label>
                        <input 
                          type="date" 
                          value={paymentData.date}
                          onChange={e => setPaymentData({...paymentData, date: e.target.value})}
                          className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none text-sm font-bold"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {paymentData.mode === 'Digital' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase">Transaction ID (UPI/NEFT)</label>
                      <input 
                        type="text" 
                        value={paymentData.instrumentNo}
                        onChange={e => setPaymentData({...paymentData, instrumentNo: e.target.value})}
                        className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none text-sm font-bold"
                        placeholder="Ref No."
                      />
                    </div>
                  </motion.div>
                )}
              </div>

              <button 
                onClick={() => {
                  if (!paymentData.amount || Number(paymentData.amount) <= 0) {
                    toast.error('Please enter a valid amount');
                    return;
                  }
                  onRecordPayment({
                    id: `PAY-${Math.floor(Math.random() * 10000)}`,
                    customerId: selectedCustomer.id,
                    customerName: selectedCustomer.name,
                    amount: Number(paymentData.amount),
                    mode: paymentData.mode,
                    instrumentNo: paymentData.instrumentNo,
                    bank: paymentData.bank,
                    date: paymentData.date,
                    recordedAt: new Date().toISOString()
                  });
                  setSelectedCustomer(null);
                  setCheckedIn(false);
                  setMobileView('menu');
                  setPaymentData({ amount: '', mode: 'Cash', instrumentNo: '', bank: '', date: new Date().toISOString().split('T')[0] });
                }}
                className="w-full py-5 bg-zinc-900 text-white rounded-[2rem] font-bold shadow-xl shadow-zinc-200 active:scale-95 transition-all mt-4"
              >
                Submit Collection
              </button>
            </div>
          ) : (
            <div className="p-6 flex flex-col items-center justify-center h-full text-center space-y-4">
              <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center text-zinc-300">
                <Settings size={40} />
              </div>
              <p className="text-zinc-500 font-medium">This module is under development.</p>
              <button onClick={() => setMobileView('menu')} className="text-zinc-900 font-bold underline">Go Back</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[800px] bg-zinc-50 max-w-md mx-auto border-x border-zinc-200 relative overflow-hidden rounded-[3rem] shadow-2xl">
      <div className="p-8 bg-white space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Daily Beat</h2>
            <p className="text-sm font-medium text-zinc-500">Wednesday, 8 April</p>
          </div>
          <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-zinc-200">
            <Calendar size={20} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-zinc-50 p-4 rounded-3xl text-center">
            <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Target</p>
            <p className="text-sm font-black text-zinc-900">₹50K</p>
          </div>
          <div className="bg-zinc-50 p-4 rounded-3xl text-center">
            <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Sales</p>
            <p className="text-sm font-black text-emerald-600">₹32K</p>
          </div>
          <div className="bg-zinc-50 p-4 rounded-3xl text-center">
            <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Visits</p>
            <p className="text-sm font-black text-blue-600">8/15</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 pb-24">
        {activeTab === 'beat' && (
          <>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-zinc-900">Scheduled Visits</h3>
              <button className="text-xs font-bold text-zinc-400 uppercase">Optimize Route</button>
            </div>
            {todayBeat.map((customer, i) => (
              <motion.div 
                key={customer.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => setSelectedCustomer(customer)}
                className="bg-white p-5 rounded-[2rem] border border-zinc-100 shadow-sm flex items-center gap-4 active:scale-95 transition-all cursor-pointer group"
              >
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-colors",
                  customer.status === 'Visited' ? "bg-emerald-50 text-emerald-600" : "bg-zinc-50 text-zinc-400"
                )}>
                  {customer.status === 'Visited' ? <CheckSquare size={24} /> : <MapPin size={24} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-zinc-900 truncate">{customer.name}</h4>
                    <span className={cn(
                      "text-[8px] font-black uppercase px-1.5 py-0.5 rounded",
                      customer.status === 'Visited' ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                    )}>
                      {customer.status}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 truncate mb-1">{customer.address}</p>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Last: {customer.lastVisit}</span>
                    {customer.outstanding > 0 && (
                      <span className="text-[10px] font-bold text-rose-500 uppercase">₹{customer.outstanding} Due</span>
                    )}
                  </div>
                </div>
                <ChevronRight size={18} className="text-zinc-300 group-hover:text-zinc-900" />
              </motion.div>
            ))}
          </>
        )}

        {activeTab === 'performance' && (
          <div className="space-y-6">
            <div className="bg-zinc-900 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-zinc-400 text-xs font-bold uppercase mb-2">Monthly Achievement</p>
                <h3 className="text-4xl font-black mb-4">84%</h3>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-[84%]" />
                </div>
                <p className="text-[10px] text-zinc-400 mt-4 font-bold uppercase tracking-widest">₹1.2M / ₹1.5M Target</p>
              </div>
              <TrendingUp className="absolute -right-8 -bottom-8 text-white/5 w-48 h-48" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
                <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Strike Rate</p>
                <p className="text-xl font-black text-zinc-900">72%</p>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
                <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">LPC</p>
                <p className="text-xl font-black text-zinc-900">4.2</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};



const ComplianceView = () => {
  const [activeSubTab, setActiveSubTab] = useState<'gstr1' | 'eway' | 'einvoice'>('gstr1');
  const [invoices] = useState<any[]>([]);

  const handleExportGSTR1 = () => {
    const gstr1Data = {
      gstin: "27AAACR1234A1Z5",
      fp: "032024",
      cur_gt: 1500000,
      b2b: invoices.map(inv => ({
        ctin: "27BBBCR5678B1Z2",
        inv: [{
          inum: inv.id,
          idt: inv.date,
          val: inv.amount,
          pos: "27",
          rchrg: "N",
          inv_typ: "R",
          itms: [{
            num: 1,
            itm_det: {
              rt: 18,
              txval: (inv.amount / 1.18).toFixed(2),
              iamt: 0,
              camt: (inv.amount * 0.09).toFixed(2),
              samt: (inv.amount * 0.09).toFixed(2),
              csamt: 0
            }
          }]
        }]
      }))
    };

    const blob = new Blob([JSON.stringify(gstr1Data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GSTR1_Export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('GSTR-1 JSON exported successfully');
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 p-1 bg-zinc-100 rounded-2xl w-fit">
        {[
          { id: 'gstr1', label: 'GSTR-1 Filing', icon: Download },
          { id: 'eway', label: 'e-Way Bill', icon: ArrowUpRight },
          { id: 'einvoice', label: 'E-Invoice (IRN)', icon: Tag },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all",
              activeSubTab === tab.id ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm">
        {activeSubTab === 'gstr1' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold">GSTR-1 Data Export</h3>
                <p className="text-sm text-zinc-500">Generate JSON for direct upload to GST Portal</p>
              </div>
              <button 
                onClick={handleExportGSTR1}
                className="bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2"
              >
                <Download size={18} /> Export JSON
              </button>
            </div>
            
            <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Total B2B Invoices</p>
                <p className="text-2xl font-black">{invoices.length}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Total Taxable Value</p>
                <p className="text-2xl font-black">₹{(invoices.reduce((acc, inv) => acc + inv.amount, 0) / 1.18).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Total Tax (GST)</p>
                <p className="text-2xl font-black">₹{(invoices.reduce((acc, inv) => acc + inv.amount, 0) * 0.18 / 1.18).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'eway' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold">e-Way Bill Management</h3>
                <p className="text-sm text-zinc-500">Auto-generate e-way bills for eligible invoices {'>'} ₹50,000</p>
              </div>
              <button className="bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2">
                <Plus size={18} /> Bulk Generate
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100">
                    <th className="pb-4">Invoice #</th>
                    <th className="pb-4">Customer</th>
                    <th className="pb-4">Amount</th>
                    <th className="pb-4">E-Way Bill #</th>
                    <th className="pb-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {invoices.map(inv => (
                    <tr key={inv.id} className="text-sm">
                      <td className="py-4 font-bold">{inv.id}</td>
                      <td className="py-4">{inv.customer}</td>
                      <td className="py-4 font-bold">₹{inv.amount.toLocaleString()}</td>
                      <td className="py-4">
                        {inv.eway ? (
                          <span className="text-emerald-600 font-mono text-xs">{inv.eway}</span>
                        ) : (
                          <span className="text-zinc-400 italic">Not Generated</span>
                        )}
                      </td>
                      <td className="py-4 text-right">
                        <button className="text-zinc-900 font-bold hover:underline">
                          {inv.eway ? 'Print' : 'Generate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeSubTab === 'einvoice' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold">E-Invoice (IRN) Generation</h3>
                <p className="text-sm text-zinc-500">Generate IRN and QR codes via IRP portal</p>
              </div>
              <button className="bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2">
                <Tag size={18} /> Sync with IRP
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {invoices.map(inv => (
                <div key={inv.id} className="p-6 rounded-3xl border border-zinc-100 bg-zinc-50 flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-zinc-400 uppercase mb-1">{inv.id}</p>
                    <p className="font-bold">{inv.customer}</p>
                    <p className="text-xs text-zinc-500 mt-2">
                      {inv.irn ? `IRN: ${inv.irn}` : 'IRN not generated'}
                    </p>
                  </div>
                  {inv.irn ? (
                    <div className="w-16 h-16 bg-white p-1 rounded-lg border border-zinc-200">
                      <div className="w-full h-full bg-zinc-900 rounded-sm" /> {/* Mock QR */}
                    </div>
                  ) : (
                    <button className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold">
                      Generate IRN
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const BeatsView = () => {
  const [activeTab, setActiveTab] = useState<'planning' | 'tracking' | 'exceptions'>('planning');
  const [beats] = useState<any[]>([]);
  const [exceptions] = useState<any[]>([]);
  const [performance] = useState<any[]>([]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex gap-2 p-1 bg-zinc-100 rounded-2xl">
          {['planning', 'tracking', 'exceptions'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={cn(
                "px-6 py-2 rounded-xl text-sm font-bold capitalize transition-all",
                activeTab === tab ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold flex items-center gap-2">
            <Calendar size={14} /> Today, {new Date().toLocaleDateString()}
          </button>
        </div>
      </div>

      {activeTab === 'planning' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {beats.map(beat => (
              <div key={beat.id} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{beat.id}</p>
                    <h3 className="text-lg font-bold text-zinc-900">{beat.name}</h3>
                  </div>
                  <span className={cn(
                    "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                    beat.status === 'Active' ? "bg-emerald-50 text-emerald-600" : "bg-zinc-50 text-zinc-500"
                  )}>
                    {beat.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 py-3 border-y border-zinc-50">
                  <div className="w-8 h-8 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-600">
                    <Users size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase">Sales Rep</p>
                    <p className="text-sm font-bold">{beat.rep}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-zinc-500">Coverage</span>
                    <span className="text-zinc-900">{beat.coverage}%</span>
                  </div>
                  <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-zinc-900 h-full transition-all" style={{ width: `${beat.coverage}%` }} />
                  </div>
                  <p className="text-[10px] text-zinc-400 font-medium">{beat.outlets} Outlets Planned</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'tracking' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm aspect-video flex flex-col items-center justify-center gap-4 text-zinc-400 relative overflow-hidden">
              <div className="absolute inset-0 bg-zinc-50 flex items-center justify-center">
                <MapPin size={48} className="text-zinc-200" />
                <p className="absolute bottom-6 text-sm font-bold text-zinc-400">Live SR Location Tracking Map</p>
              </div>
              {/* Mock SR Markers */}
              <div className="absolute top-1/4 left-1/3 w-8 h-8 bg-zinc-900 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white animate-bounce">
                <Truck size={16} />
              </div>
              <div className="absolute top-1/2 right-1/4 w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                <Truck size={16} />
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
              <h3 className="text-lg font-bold mb-4">Daily Performance Scorecard</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100">
                      <th className="pb-4">Sales Rep</th>
                      <th className="pb-4">Visits (P/A)</th>
                      <th className="pb-4">Orders</th>
                      <th className="pb-4">Order Value</th>
                      <th className="pb-4 text-right">Efficiency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {performance.map(p => (
                      <tr key={p.rep} className="text-sm">
                        <td className="py-4 font-bold">{p.rep}</td>
                        <td className="py-4">{p.planned} / {p.visited}</td>
                        <td className="py-4">{p.orders}</td>
                        <td className="py-4 font-bold">₹{p.value.toLocaleString()}</td>
                        <td className="py-4 text-right">
                          <span className={cn(
                            "px-2 py-1 rounded-lg text-[10px] font-bold",
                            p.efficiency > 70 ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                          )}>
                            {p.efficiency}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-zinc-900 text-white p-6 rounded-3xl shadow-lg">
              <h4 className="font-bold mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-emerald-400" /> Beat Coverage Heat Map
              </h4>
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 25 }).map((_, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "aspect-square rounded-md",
                      i % 3 === 0 ? "bg-emerald-500/40" : i % 2 === 0 ? "bg-emerald-500/20" : "bg-white/5"
                    )} 
                  />
                ))}
              </div>
              <p className="text-[10px] text-zinc-400 mt-4 text-center">High density coverage in Downtown area</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
              <h4 className="font-bold mb-4">Live Activity Feed</h4>
              <div className="space-y-4">
                {[
                  { time: '10:45 AM', rep: 'Rahul Sharma', action: 'Order Placed', customer: 'Krishna Stores' },
                  { time: '10:30 AM', rep: 'Amit Patel', action: 'Check-in', customer: 'Modern Retail' },
                  { time: '10:15 AM', rep: 'Suresh Kumar', action: 'Attendance', customer: 'Market Hub' },
                ].map((log, i) => (
                  <div key={i} className="flex gap-3 text-xs">
                    <span className="text-zinc-400 font-mono shrink-0">{log.time}</span>
                    <p className="text-zinc-600">
                      <span className="font-bold text-zinc-900">{log.rep}</span> {log.action} at <span className="font-bold text-zinc-900">{log.customer}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'exceptions' && (
        <div className="space-y-4">
          {exceptions.map(ex => (
            <div key={ex.id} className={cn(
              "p-6 rounded-3xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4",
              ex.severity === 'high' ? "bg-rose-50 border-rose-100" : "bg-amber-50 border-amber-100"
            )}>
              <div className="flex items-start gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  ex.severity === 'high' ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"
                )}>
                  <AlertCircle size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-zinc-900">{ex.type}</h4>
                    <span className="text-[10px] font-black uppercase text-zinc-400">{ex.rep}</span>
                  </div>
                  <p className="text-sm text-zinc-600">{ex.detail || `Idle for ${ex.duration} at ${ex.location}`}</p>
                </div>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <button className="flex-1 px-4 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold hover:bg-zinc-50">
                  Call Rep
                </button>
                <button className="flex-1 px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800">
                  Acknowledge
                </button>
              </div>
            </div>
          ))}
          {exceptions.length === 0 && (
            <div className="text-center py-12 text-zinc-500">No exceptions detected today.</div>
          )}
        </div>
      )}
    </div>
  );
};

const AddUserModal = ({ isOpen, onClose, onAdd, initialData }: { isOpen: boolean, onClose: () => void, onAdd: (u: any) => void, initialData?: UserProfile | null }) => {
  const [formData, setFormData] = useState({
    name: '', email: '', role: 'Sales Representative' as Role, isActive: true, territories: [] as string[],
    permissions: { inventory: [] as string[], sales: [] as string[], users: [] as string[] }
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        email: initialData.email,
        role: initialData.role,
        isActive: initialData.isActive,
        territories: initialData.territories || [],
        permissions: initialData.permissions || { inventory: [], sales: [], users: [] }
      });
    } else {
      setFormData({
        name: '', email: '', role: 'Sales Representative', isActive: true, territories: [],
        permissions: { inventory: [], sales: [], users: [] }
      });
    }
  }, [initialData, isOpen]);

  const togglePermission = (module: string, action: string) => {
    setFormData(prev => {
      const current = (prev.permissions as any)[module] || [];
      const updated = current.includes(action) 
        ? current.filter((a: string) => a !== action)
        : [...current, action];
      return { ...prev, permissions: { ...prev.permissions, [module]: updated } };
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-8 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
          <div>
            <h2 className="text-2xl font-bold">{initialData ? 'Edit User Profile' : 'Create New User'}</h2>
            <p className="text-xs text-zinc-500 mt-1">Configure access levels and regional assignments</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-zinc-200 rounded-full transition-colors"><X size={24} /></button>
        </div>
        <div className="p-8 space-y-8 overflow-y-auto">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Full Name</label>
              <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-900 font-medium" placeholder="e.g. John Doe" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Email Address</label>
              <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-900 font-medium" placeholder="john@example.com" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">System Role</label>
              <select 
                value={formData.role} 
                onChange={e => setFormData({...formData, role: e.target.value as Role})} 
                className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-900 font-bold text-sm"
              >
                <option>Super Admin</option>
                <option>Distribution Manager</option>
                <option>Sales Manager</option>
                <option>Sales Representative</option>
                <option>Warehouse Manager</option>
                <option>Warehouse Operator</option>
                <option>Accounts Executive</option>
                <option>MIS Analyst</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Territories (Comma separated)</label>
              <input 
                type="text" 
                value={formData.territories.join(', ')}
                onChange={e => setFormData({...formData, territories: e.target.value.split(',').map(t => t.trim())})} 
                className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-900 font-medium" 
                placeholder="e.g. Beat 01, Beat 02" 
              />
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Granular Permissions</label>
            <div className="grid grid-cols-1 gap-4">
              {[
                { id: 'inventory', label: 'Inventory Management', actions: ['read', 'write', 'delete'] },
                { id: 'sales', label: 'Sales & Orders', actions: ['read', 'write', 'approve'] },
                { id: 'users', label: 'User & Role Control', actions: ['read', 'write'] },
              ].map(module => (
                <div key={module.id} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-center justify-between">
                  <span className="text-sm font-bold text-zinc-900">{module.label}</span>
                  <div className="flex gap-2">
                    {module.actions.map(action => (
                      <button 
                        key={action}
                        onClick={() => togglePermission(module.id, action)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all",
                          (formData.permissions as any)[module.id]?.includes(action)
                            ? "bg-zinc-900 text-white"
                            : "bg-white text-zinc-400 border border-zinc-200"
                        )}
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button 
            onClick={() => onAdd({...formData, uid: initialData?.uid || Math.random().toString(36).substr(2, 9), effectiveDate: initialData?.effectiveDate || new Date().toISOString().split('T')[0]})} 
            className="w-full py-5 bg-zinc-900 text-white rounded-[2rem] font-bold hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-200 active:scale-95"
          >
            {initialData ? 'Update User Account' : 'Create User Account'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const UserManagementView = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  const handleToggleStatus = (uid: string) => {
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, isActive: !u.isActive } : u));
    toast.success('User status updated');
  };

  const handleEditUser = (user: UserProfile) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-8">
      <AddUserModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEditingUser(null); }} 
        onAdd={(u) => {
          if (editingUser) {
            setUsers(prev => prev.map(user => user.uid === editingUser.uid ? { ...u, uid: editingUser.uid } : user));
            toast.success('User updated successfully');
          } else {
            setUsers(prev => [u, ...prev]);
            toast.success('User created successfully');
          }
          setIsModalOpen(false);
          setEditingUser(null);
        }}
        initialData={editingUser}
      />

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">User & Role Management</h2>
          <p className="text-sm text-zinc-500">Manage system users, roles, and granular permissions</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-zinc-200"
        >
          <UserPlus size={18} /> Add User
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-zinc-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">User</th>
              <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Role</th>
              <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Territories</th>
              <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Status</th>
              <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {users.map(u => (
              <tr key={u.uid} className={cn("hover:bg-zinc-50 transition-colors", !u.isActive && "opacity-50")}>
                <td className="px-6 py-4">
                  <p className="font-bold text-zinc-900">{u.name}</p>
                  <p className="text-xs text-zinc-500">{u.email}</p>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-zinc-100 rounded-lg text-[10px] font-bold text-zinc-600 uppercase">
                    {u.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {u.territories?.map(t => (
                      <span key={t} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold">{t}</span>
                    )) || <span className="text-zinc-400 text-xs">Global</span>}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <button 
                    onClick={() => handleToggleStatus(u.uid)}
                    className={cn(
                      "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                      u.isActive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                    )}
                  >
                    {u.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => handleEditUser(u)}
                      className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400 hover:text-zinc-900"
                    >
                      <Settings size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Shield size={20} className="text-zinc-400" />
            Security Policies
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-zinc-50 rounded-2xl">
              <div>
                <p className="text-sm font-bold">Two-Factor Authentication</p>
                <p className="text-xs text-zinc-500">Required for Admin & Accounts</p>
              </div>
              <div className="w-12 h-6 bg-zinc-900 rounded-full relative">
                <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
              </div>
            </div>
            <div className="flex justify-between items-center p-4 bg-zinc-50 rounded-2xl">
              <div>
                <p className="text-sm font-bold">Password Expiry</p>
                <p className="text-xs text-zinc-500">Force change every 90 days</p>
              </div>
              <span className="text-xs font-bold text-zinc-400">ENABLED</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Clock size={20} className="text-zinc-400" />
            Session Management
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-zinc-50 rounded-2xl">
              <div>
                <p className="text-sm font-bold">Admin Session Timeout</p>
                <p className="text-xs text-zinc-500">Auto-logout after inactivity</p>
              </div>
              <span className="text-sm font-bold">15 Mins</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-zinc-50 rounded-2xl">
              <div>
                <p className="text-sm font-bold">Field App Session</p>
                <p className="text-xs text-zinc-500">Persistent login for SRs</p>
              </div>
              <span className="text-sm font-bold">30 Days</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 text-white p-8 rounded-[2.5rem] shadow-xl">
        <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
          <History size={20} className="text-zinc-400" />
          System Audit Log (Security Events)
        </h3>
        <div className="space-y-4">
          {[
            { time: '2024-03-22 14:30', user: 'admin@example.com', event: 'User Creation', detail: 'Created user sr2@example.com' },
            { time: '2024-03-22 12:15', user: 'sr1@example.com', event: 'Login', detail: 'Successful login from 192.168.1.1' },
            { time: '2024-03-21 18:45', user: 'admin@example.com', event: 'Role Change', detail: 'Updated role for wh@example.com to Warehouse Manager' },
          ].map((log, i) => (
            <div key={i} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10 gap-2">
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-mono text-zinc-500">{log.time}</span>
                <div>
                  <p className="text-sm font-bold">{log.event}</p>
                  <p className="text-xs text-zinc-400">{log.user}</p>
                </div>
              </div>
              <p className="text-xs text-zinc-300 italic">"{log.detail}"</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ReturnsView = ({ products, onUpdateStock }: { products: any[], onUpdateStock: (sku: string, qty: number, batch?: any, reason?: string) => void }) => {
  const [returns, setReturns] = useState<any[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newReturnData, setNewReturnData] = useState({
    customer: '', type: 'Damaged', sku: '', qty: 0
  });

  const handleAddReturn = () => {
    if (!newReturnData.customer || !newReturnData.sku || newReturnData.qty <= 0) {
      toast.error('Please fill all fields correctly');
      return;
    }

    const product = products.find(p => p.sku === newReturnData.sku);
    const newReturn = {
      id: `RMA-${Math.floor(Math.random() * 1000)}`,
      customer: newReturnData.customer,
      type: newReturnData.type,
      items: 1,
      itemsList: [{ sku: newReturnData.sku, qty: newReturnData.qty }],
      value: (product?.ptr || 0) * newReturnData.qty,
      status: 'Pending Approval',
      date: new Date().toISOString().split('T')[0]
    };

    setReturns(prev => [newReturn, ...prev]);
    onUpdateStock(newReturnData.sku, newReturnData.qty, null, `Return: ${newReturn.id} (${newReturnData.type})`);
    setIsAddModalOpen(false);
    toast.success('Return request processed and stock updated');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Returns & Damage Management</h2>
          <p className="text-sm text-zinc-500">Manage RMAs, physical verification, and credit notes</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-zinc-200"
        >
          <Plus size={18} /> New Return
        </button>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4">
            <h3 className="text-lg font-bold">New Return Request</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Customer</label>
                <input 
                  type="text" 
                  value={newReturnData.customer} 
                  onChange={e => setNewReturnData({...newReturnData, customer: e.target.value})}
                  className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none" 
                  placeholder="Customer Name"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Return Type</label>
                <select 
                  value={newReturnData.type} 
                  onChange={e => setNewReturnData({...newReturnData, type: e.target.value})}
                  className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none font-bold"
                >
                  <option>Damaged</option>
                  <option>Expired</option>
                  <option>Wrong Delivery</option>
                  <option>Customer Return</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Product (SKU)</label>
                <select 
                  value={newReturnData.sku} 
                  onChange={e => setNewReturnData({...newReturnData, sku: e.target.value})}
                  className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none font-bold"
                >
                  <option value="">Select Product</option>
                  {products.map(p => (
                    <option key={p.sku} value={p.sku}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Quantity</label>
                <input 
                  type="number" 
                  value={newReturnData.qty} 
                  onChange={e => setNewReturnData({...newReturnData, qty: Number(e.target.value)})}
                  className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none" 
                />
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <button onClick={() => setIsAddModalOpen(false)} className="flex-1 py-3 bg-zinc-100 rounded-xl font-bold">Cancel</button>
              <button onClick={handleAddReturn} className="flex-1 py-3 bg-zinc-900 text-white rounded-xl font-bold">Submit Return</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Pending Approval', value: 8, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Awaiting Verification', value: 5, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'RTC Claims Pending', value: 12, color: 'text-rose-600', bg: 'bg-rose-50' },
        ].map((stat, i) => (
          <div key={i} className={cn("p-6 rounded-3xl border border-zinc-200 shadow-sm", stat.bg)}>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <p className={cn("text-3xl font-black", stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[2.5rem] border border-zinc-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">RMA Details</th>
              <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Type</th>
              <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Value</th>
              <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Status</th>
              <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {returns.map(r => (
              <tr key={r.id} className="hover:bg-zinc-50 transition-colors">
                <td className="px-6 py-4">
                  <p className="font-bold text-zinc-900">{r.id}</p>
                  <p className="text-xs text-zinc-500">{r.customer} • {r.date}</p>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-zinc-100 rounded-lg text-[10px] font-bold text-zinc-600 uppercase">
                    {r.type}
                  </span>
                </td>
                <td className="px-6 py-4 font-bold text-zinc-900">₹{r.value.toLocaleString()}</td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                    r.status === 'Credit Issued' ? "bg-emerald-50 text-emerald-600" :
                    r.status === 'Verified' ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"
                  )}>
                    {r.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => toast.info(`Processing ${r.id}...`)}
                    className="text-xs font-bold text-zinc-900 hover:underline"
                  >
                    Manage
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-zinc-900 text-white p-8 rounded-[2.5rem] shadow-xl">
        <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
          <Truck size={20} className="text-zinc-400" />
          Return-to-Company (RTC) Claims
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {['HUL', 'ITC', 'Amul', 'Britannia'].map(brand => (
            <div key={brand} className="p-6 bg-white/5 rounded-3xl border border-white/10">
              <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">{brand}</p>
              <p className="text-xl font-bold mb-4">₹45,200</p>
              <button 
                onClick={() => toast.success(`RTC Claim generated for ${brand}`)}
                className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-bold uppercase transition-all"
              >
                Generate Claim
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ReportsView = ({ products }: { products: any[] }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'standard' | 'builder'>('dashboard');
  const [builderFields, setBuilderFields] = useState<string[]>([]);
  const brands = Array.from(new Set(products.map(p => p.brand)));

  const reports = [
    { name: 'Daily Sales Summary', freq: 'Daily', users: 'Manager, ASM' },
    { name: 'Stock Position Report', freq: 'Daily', users: 'Warehouse, Manager' },
    { name: 'Order Fulfilment', freq: 'Daily', users: 'Operations' },
    { name: 'Primary vs Secondary', freq: 'Weekly', users: 'Manager, HUL/ITC ASM' },
    { name: 'Customer Ledger', freq: 'On-demand', users: 'Accounts, SR' },
    { name: 'Ageing Analysis', freq: 'Weekly', users: 'Accounts, Manager' },
  ];

  const exportToPDF = (reportName: string) => {
    const doc = new jsPDF() as any;
    doc.setFontSize(20);
    doc.text(reportName, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
    
    const tableData = products.map(p => [p.sku, p.name, p.brand, p.stock, p.mrp]);
    doc.autoTable({
      startY: 40,
      head: [['SKU', 'Product Name', 'Brand', 'Stock', 'MRP']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [24, 24, 27] }
    });
    
    doc.save(`${reportName.replace(/\s+/g, '_')}.pdf`);
    toast.success('PDF generated successfully');
  };

  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    const items = Array.from(builderFields);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setBuilderFields(items);
  };

  const addField = (field: string) => {
    if (!builderFields.includes(field)) {
      setBuilderFields([...builderFields, field]);
    }
  };

  const removeField = (field: string) => {
    setBuilderFields(builderFields.filter(f => f !== field));
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 p-1 bg-zinc-100 rounded-2xl w-fit">
        {[
          { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
          { id: 'standard', label: 'Standard Reports', icon: ClipboardList },
          { id: 'builder', label: 'Report Builder', icon: Settings },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all",
              activeTab === tab.id ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Today's Sales", value: "₹1.2L", sub: "Target: ₹1.5L", color: "text-zinc-900" },
              { label: "Pending Orders", value: "24", sub: "Value: ₹4.2L", color: "text-amber-600" },
              { label: "OOS SKUs", value: "12", sub: "Critical: 5", color: "text-rose-600" },
              { label: "Beat Coverage", value: "65%", sub: "18/24 Visited", color: "text-emerald-600" },
            ].map((stat, i) => (
              <div key={i} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{stat.label}</p>
                <p className={cn("text-2xl font-black", stat.color)}>{stat.value}</p>
                <p className="text-xs text-zinc-500 mt-1">{stat.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm min-h-[300px]">
              <h3 className="text-lg font-bold mb-6">Receivables Ageing</h3>
              <div className="flex items-center justify-center h-48">
                <div className="relative w-40 h-40 rounded-full border-[16px] border-zinc-100 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-[16px] border-zinc-900 border-t-transparent border-r-transparent rotate-45" />
                  <div className="text-center">
                    <p className="text-xl font-black">₹12.5L</p>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase">Total</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-zinc-900" />
                  <span className="text-xs text-zinc-500">0-30 Days (60%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-zinc-400" />
                  <span className="text-xs text-zinc-500">31-60 Days (25%)</span>
                </div>
              </div>
            </div>

            <div className="bg-zinc-900 text-white p-8 rounded-[2.5rem] shadow-xl">
              <h3 className="text-lg font-bold mb-6">Stock Health Index</h3>
              <div className="space-y-6">
                {[
                  { label: 'In-Stock SKUs', value: 85, color: 'bg-emerald-500' },
                  { label: 'Low Stock', value: 10, color: 'bg-amber-500' },
                  { label: 'Out of Stock', value: 5, color: 'bg-rose-500' },
                ].map((item, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span>{item.label}</span>
                      <span>{item.value}%</span>
                    </div>
                    <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                      <div className={cn("h-full transition-all", item.color)} style={{ width: `${item.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'standard' && (
        <div className="bg-white rounded-[2.5rem] border border-zinc-200 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Report Name</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Frequency</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Key Users</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {reports.map((r, i) => (
                <tr key={i} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-zinc-900">{r.name}</td>
                  <td className="px-6 py-4 text-sm text-zinc-500">{r.freq}</td>
                  <td className="px-6 py-4 text-sm text-zinc-500">{r.users}</td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => exportToPDF(r.name)}
                      className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400 hover:text-zinc-900"
                    >
                      <Download size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'builder' && (
        <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1 space-y-6">
              <h3 className="text-lg font-bold">Custom Report Builder</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Date Range</label>
                  <select className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none">
                    <option>Last 7 Days</option>
                    <option>This Month</option>
                    <option>Custom Range</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Brand Filter</label>
                  <select className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none">
                    <option>All Brands</option>
                    {brands.map(brand => (
                      <option key={brand}>{brand}</option>
                    ))}
                  </select>
                </div>
              </div>

              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="builder-fields">
                  {(provided) => (
                    <div 
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={cn(
                        "p-8 border-2 border-dashed border-zinc-200 rounded-[2rem] flex flex-wrap gap-2 min-h-[150px] items-start",
                        builderFields.length === 0 && "items-center justify-center text-zinc-400"
                      )}
                    >
                      {builderFields.length === 0 ? (
                        <div className="text-center">
                          <Plus size={32} className="mx-auto mb-2" />
                          <p className="text-sm font-bold">Drag & Drop Fields Here</p>
                          <p className="text-xs">Sales, Volume, Margin, Outlets, etc.</p>
                        </div>
                      ) : (
                        builderFields.map((field, index) => (
                          // @ts-ignore
                          <Draggable draggableId={field} index={index} key={field}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold flex items-center gap-2 group"
                              >
                                {field}
                                <button onClick={() => removeField(field)} className="hover:text-rose-400">
                                  <X size={14} />
                                </button>
                              </div>
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              <div className="flex gap-2">
                <button 
                  onClick={() => exportToPDF('Custom Builder Report')}
                  className="flex-1 py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all"
                >
                  Generate & Export PDF
                </button>
                <button 
                  onClick={() => toast.info('Report template saved')}
                  className="px-6 py-4 bg-zinc-100 text-zinc-900 rounded-2xl font-bold hover:bg-zinc-200 transition-all"
                >
                  Save Template
                </button>
              </div>
            </div>
            <div className="w-full md:w-64 space-y-4">
              <h4 className="text-sm font-bold text-zinc-400 uppercase">Available Fields</h4>
              <div className="space-y-2">
                {['Net Sales', 'Gross Margin', 'Outlet Count', 'SKU Volume', 'Return Value', 'Tax Amount'].map(f => (
                  <button 
                    key={f} 
                    onClick={() => addField(f)}
                    className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-left hover:border-zinc-900 transition-all"
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const NotificationsView = () => {
  const [notifications] = useState<any[]>([]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'Low Stock': return <Package className="text-amber-600" size={18} />;
      case 'Expiry': return <Clock className="text-rose-600" size={18} />;
      case 'Credit Limit': return <ShieldAlert className="text-rose-600" size={18} />;
      case 'Payment Overdue': return <AlertCircle className="text-rose-600" size={18} />;
      default: return <Bell className="text-zinc-600" size={18} />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Notifications & Alerts</h2>
          <p className="text-sm text-zinc-500">System-wide operational alerts and triggers</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-xl text-sm font-bold hover:bg-zinc-200 transition-all">
            Mark all as read
          </button>
          <button className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-all flex items-center gap-2">
            <Settings size={16} /> Alert Settings
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-zinc-200 overflow-hidden shadow-sm">
        <div className="divide-y divide-zinc-100">
          {notifications.map((n) => (
            <div key={n.id} className={cn(
              "p-6 flex items-start gap-4 hover:bg-zinc-50 transition-all cursor-pointer",
              n.status === 'unread' ? "bg-zinc-50/50" : ""
            )}>
              <div className="w-10 h-10 rounded-2xl bg-white border border-zinc-100 flex items-center justify-center shadow-sm">
                {getIcon(n.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="font-bold text-zinc-900">{n.type} Alert</h4>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">{n.time}</span>
                </div>
                <p className="text-sm text-zinc-600 mb-2">{n.message}</p>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">Recipients: {n.recipients}</span>
                  <div className="flex gap-2">
                    {['Push', 'SMS', 'WhatsApp', 'Email'].map(channel => (
                      <span key={channel} className="px-2 py-0.5 bg-zinc-100 rounded-md text-[8px] font-black text-zinc-500 uppercase">
                        {channel}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              {n.status === 'unread' && (
                <div className="w-2 h-2 bg-zinc-900 rounded-full mt-2" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-zinc-900 text-white p-8 rounded-[2.5rem] shadow-xl">
        <h3 className="text-lg font-bold mb-6">Alert Trigger Conditions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { type: 'Low Stock', trigger: 'Stock < reorder level', recipients: 'Warehouse Mgr, Purchase Mgr' },
            { type: 'Expiry Alert', trigger: 'Expiry within 60 days', recipients: 'Warehouse Mgr, Manager' },
            { type: 'Credit Limit Breach', trigger: 'Order > credit limit', recipients: 'SR, Accounts, Manager' },
            { type: 'Payment Overdue', trigger: 'Invoice > credit period', recipients: 'SR, Accounts Manager' },
            { type: 'Beat Miss', trigger: 'No visit by 5 PM', recipients: 'Sales Manager' },
            { type: 'SR Idle', trigger: 'No GPS activity > 45 min', recipients: 'Sales Manager' },
          ].map((item, i) => (
            <div key={i} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/10">
              <div>
                <p className="text-xs font-bold text-zinc-400 uppercase mb-1">{item.type}</p>
                <p className="text-sm font-medium">{item.trigger}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Recipients</p>
                <p className="text-[10px] text-zinc-400">{item.recipients}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Login = () => {
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          name: user.displayName || 'New User',
          email: user.email,
          role: 'Sales Representative',
          isActive: true,
          companyId: 'COMP-001',
          createdAt: new Date().toISOString(),
          effectiveDate: new Date().toISOString().split('T')[0]
        });
      }
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center border border-zinc-200"
      >
        <div className="w-20 h-20 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <TrendingUp className="text-white w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold text-zinc-900 mb-2">DMS Pro</h1>
        <p className="text-zinc-500 mb-8">HUL & ITC Distribution Management System</p>
        <button 
          onClick={handleLogin}
          className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-semibold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-3"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
          Sign in with Google
        </button>
      </motion.div>
    </div>
  );
};

const SchemeManagementView = () => {
  const [schemes] = useState<any[]>([]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-zinc-900">Trade Schemes</h2>
        <button 
          onClick={() => toast.info('Create Scheme modal coming soon')}
          className="bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2"
        >
          <Plus size={18} /> Create Scheme
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {schemes.map((s) => (
          <div key={s.id} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-600">
                <Tag size={24} />
              </div>
              <span className={cn(
                "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                s.status === 'Active' ? "bg-emerald-50 text-emerald-600" : "bg-zinc-50 text-zinc-500"
              )}>
                {s.status}
              </span>
            </div>
            <h3 className="text-lg font-bold text-zinc-900 mb-1">{s.name}</h3>
            <p className="text-xs text-zinc-500 mb-4">{s.brand} • {s.sku}</p>
            
            <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
              <p className="text-xs font-bold text-zinc-400 uppercase mb-1">Offer Details</p>
              <p className="text-sm font-bold text-zinc-900">
                {s.type === 'buy_x_get_y' ? `Buy ${s.buyQty} Get ${s.getQty} Free` :
                 s.type === 'discount_percentage' ? `${s.discountValue}% Off on Billing` :
                 `Flat ₹${s.discountValue} Discount`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PickingListView = ({ orders }: { orders: any[] }) => {
  const pendingOrders = orders.filter(o => o.status === 'Pending');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-zinc-900">Warehouse Picking List</h2>
        <button 
          onClick={() => toast.info('Printing all picking lists...')}
          className="px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-zinc-50 transition-all"
        >
          <Download size={16} /> Print All
        </button>
      </div>

      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order.id} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <div>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{order.id}</p>
                <h3 className="text-lg font-bold text-zinc-900">{order.customer}</h3>
              </div>
              <button 
                onClick={() => toast.success(`Picking list generated for ${order.id}`)}
                className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-sm font-bold flex items-center gap-2"
              >
                <ClipboardList size={16} /> Generate List
              </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                <p className="text-[10px] font-bold text-zinc-400 uppercase">Total Items</p>
                <p className="text-lg font-bold">{order.items}</p>
              </div>
              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                <p className="text-[10px] font-bold text-zinc-400 uppercase">Priority</p>
                <p className="text-lg font-bold text-amber-600">High</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const WarehouseManagementView = ({ products, onUpdateStock }: { products: any[], onUpdateStock: (sku: string, qty: number, batch?: any, reason?: string) => void }) => {
  const [activeSubTab, setActiveSubTab] = useState<'locations' | 'cycle' | 'expiry' | 'transfer'>('locations');
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferData, setTransferData] = useState({ sku: '', from: 'Main Warehouse', to: 'Sales Van 01', qty: 0 });

  const handleTransfer = () => {
    if (!transferData.sku || transferData.qty <= 0) {
      toast.error('Please select product and valid quantity');
      return;
    }
    // In a real app, we'd deduct from 'from' and add to 'to'. 
    // Here we just log the movement and update the total stock (which remains same, but we log the reason)
    onUpdateStock(transferData.sku, 0, null, `Transfer: ${transferData.from} -> ${transferData.to} (Qty: ${transferData.qty})`);
    setIsTransferModalOpen(false);
    toast.success('Stock transfer initiated');
  };
  
  const locations = [
    { id: 'LOC-001', name: 'Main Warehouse', type: 'Warehouse', capacity: '85%', manager: 'Rajesh M.' },
    { id: 'LOC-002', name: 'Secondary Godown', type: 'Godown', capacity: '40%', manager: 'Suresh K.' },
    { id: 'VAN-001', name: 'Sales Van 01', type: 'Van', capacity: '65%', manager: 'Rahul S.' },
  ];

  const cycleCounts = [
    { id: 'CC-001', date: '2024-03-25', location: 'Main Warehouse', category: 'Laundry', status: 'Scheduled' },
    { id: 'CC-002', date: '2024-03-20', location: 'Secondary Godown', category: 'Foods', status: 'Completed', variance: '-2.5%' },
  ];

  const expiryData = [
    { sku: 'HUL-001', name: 'Surf Excel 1kg', batch: 'BN-2024-001', expiry: '2024-05-30', qty: 150, daysLeft: 53 },
    { sku: 'ITC-002', name: 'Dark Fantasy 75g', batch: 'BN-2024-004', expiry: '2024-04-15', qty: 15, daysLeft: 8 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex gap-2 p-1 bg-zinc-100 rounded-2xl w-fit">
        {[
          { id: 'locations', label: 'Locations', icon: Warehouse },
          { id: 'cycle', label: 'Cycle Count', icon: CheckSquare },
          { id: 'expiry', label: 'Expiry Tracker', icon: Clock },
          { id: 'transfer', label: 'Stock Transfer', icon: ArrowLeftRight },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all",
              activeSubTab === tab.id ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'locations' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {locations.map(loc => (
            <div key={loc.id} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-600">
                  {loc.type === 'Van' ? <Truck size={24} /> : <Warehouse size={24} />}
                </div>
                <span className="px-2 py-1 bg-zinc-100 rounded-lg text-[10px] font-bold text-zinc-600 uppercase">
                  {loc.type}
                </span>
              </div>
              <h3 className="text-lg font-bold text-zinc-900 mb-1">{loc.name}</h3>
              <p className="text-xs text-zinc-500 mb-4">Manager: {loc.manager}</p>
              
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-zinc-400 uppercase">Utilization</span>
                  <span className="text-zinc-900">{loc.capacity}</span>
                </div>
                <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-zinc-900 h-full transition-all" 
                    style={{ width: loc.capacity }}
                  />
                </div>
              </div>
              <button 
                onClick={() => toast.info(`Opening stock ledger for ${loc.name}`)}
                className="w-full mt-6 py-3 bg-zinc-50 text-zinc-900 rounded-2xl text-sm font-bold hover:bg-zinc-100 transition-all border border-zinc-100"
              >
                View Stock Ledger
              </button>
            </div>
          ))}
        </div>
      )}

      {activeSubTab === 'cycle' && (
        <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold">Cycle Count & Verification</h3>
              <p className="text-sm text-zinc-500">Schedule and manage physical stock audits</p>
            </div>
            <button className="bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2">
              <Plus size={18} /> New Count
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100">
                  <th className="pb-4">ID</th>
                  <th className="pb-4">Date</th>
                  <th className="pb-4">Location</th>
                  <th className="pb-4">Category</th>
                  <th className="pb-4">Status</th>
                  <th className="pb-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {[
                  { id: 'CC-001', date: '2024-03-25', location: 'Main Warehouse', category: 'Laundry', status: 'Scheduled' },
                  { id: 'CC-002', date: '2024-03-20', location: 'Secondary Godown', category: 'Foods', status: 'Completed', variance: '-2.5%' },
                ].map(count => (
                  <tr key={count.id} className="text-sm">
                    <td className="py-4 font-bold">{count.id}</td>
                    <td className="py-4">{count.date}</td>
                    <td className="py-4">{count.location}</td>
                    <td className="py-4">{count.category}</td>
                    <td className="py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                        count.status === 'Completed' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                      )}>
                        {count.status}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <button className="text-zinc-900 font-bold hover:underline">
                        {count.status === 'Completed' ? 'View Variance' : 'Start Count'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'transfer' && (
        <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold">Inter-Location Transfer</h3>
              <p className="text-sm text-zinc-500">Move stock between warehouses, godowns, and vans</p>
            </div>
            <button 
              onClick={() => setIsTransferModalOpen(true)}
              className="bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2"
            >
              <Plus size={18} /> New Transfer
            </button>
          </div>

          <div className="p-8 border-2 border-dashed border-zinc-100 rounded-[2rem] flex flex-col items-center justify-center text-zinc-400 gap-4">
            <ArrowLeftRight size={48} />
            <div className="text-center">
              <p className="font-bold text-zinc-900">No active transfers</p>
              <p className="text-sm">Initiate a transfer to move stock between locations.</p>
            </div>
          </div>
        </div>
      )}

      {isTransferModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4">
            <h3 className="text-lg font-bold">New Stock Transfer</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Product</label>
                <select 
                  value={transferData.sku} 
                  onChange={e => setTransferData({...transferData, sku: e.target.value})}
                  className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none font-bold"
                >
                  <option value="">Select Product</option>
                  {products.map(p => (
                    <option key={p.sku} value={p.sku}>{p.name} (Stock: {p.stock})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">From</label>
                  <select className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none text-sm">
                    <option>Main Warehouse</option>
                    <option>Secondary Godown</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">To</label>
                  <select className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none text-sm">
                    <option>Sales Van 01</option>
                    <option>Sales Van 02</option>
                    <option>Secondary Godown</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Quantity</label>
                <input 
                  type="number" 
                  value={transferData.qty} 
                  onChange={e => setTransferData({...transferData, qty: Number(e.target.value)})}
                  className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none" 
                />
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <button onClick={() => setIsTransferModalOpen(false)} className="flex-1 py-3 bg-zinc-100 rounded-xl font-bold">Cancel</button>
              <button onClick={handleTransfer} className="flex-1 py-3 bg-zinc-900 text-white rounded-xl font-bold">Initiate Transfer</button>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'expiry' && (
        <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold">Near-Expiry Management</h3>
              <p className="text-sm text-zinc-500">SKUs expiring within 60 days threshold</p>
            </div>
            <button className="bg-rose-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-rose-700 transition-all">
              <Shield size={18} /> Initiate RTC Workflow
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {expiryData.map((item, i) => (
              <div key={i} className="p-6 rounded-3xl border border-zinc-100 bg-zinc-50 flex justify-between items-center">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-zinc-400 uppercase">{item.sku}</p>
                  <h4 className="font-bold text-zinc-900">{item.name}</h4>
                  <p className="text-xs text-zinc-500">Batch: {item.batch}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={cn(
                      "px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase",
                      item.daysLeft < 15 ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"
                    )}>
                      {item.daysLeft} Days Left
                    </span>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Qty: {item.qty}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-zinc-400 uppercase mb-1">Expiry Date</p>
                  <p className="font-bold text-rose-600">{item.expiry}</p>
                  <button className="mt-2 text-[10px] font-bold text-zinc-900 uppercase hover:underline">Block for Orders</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Dashboard = ({ products, orders }: { products: any[], orders: any[] }) => {
  const [alerts] = useState<any[]>([]);

  const todaySales = orders
    .filter(o => o.date === new Date().toISOString().split('T')[0])
    .reduce((acc, o) => acc + o.amount, 0);
    
  const pendingOrdersCount = orders.filter(o => o.status === 'Pending' || o.status === 'On Hold').length;
  const outOfStockCount = products.filter(p => p.stock <= 0).length;
  const lowStockCount = products.filter(p => p.stock > 0 && p.stock < (p.reorderLevel || 100)).length;

  return (
    <div className="space-y-6">
      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-zinc-900 font-bold">
              <Bell size={20} />
              <h2>Operational Alerts & Reorder Suggestions</h2>
            </div>
            <button className="text-xs font-bold text-zinc-500 hover:text-zinc-900">View All</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {alerts.map(alert => (
              <div key={alert.id} className={cn(
                "p-4 rounded-2xl border flex flex-col gap-2",
                alert.severity === 'high' ? "bg-rose-50 border-rose-100" : "bg-amber-50 border-amber-100"
              )}>
                <div className="flex items-start gap-3">
                  <AlertCircle className={cn(
                    "mt-0.5",
                    alert.severity === 'high' ? "text-rose-600" : "text-amber-600"
                  )} size={18} />
                  <p className={cn(
                    "text-sm font-medium",
                    alert.severity === 'high' ? "text-rose-900" : "text-amber-900"
                  )}>{alert.message}</p>
                </div>
                {alert.suggestion && (
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-zinc-400">Auto-Suggestion</span>
                    <button className="px-3 py-1 bg-white border border-zinc-200 rounded-lg text-[10px] font-bold text-zinc-900 hover:bg-zinc-50 transition-all">
                      {alert.suggestion}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Today\'s Sales', value: `₹${(todaySales / 1000).toFixed(1)}K`, icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Pending Orders', value: pendingOrdersCount.toString(), icon: ShoppingCart, color: 'bg-amber-50 text-amber-600' },
          { label: 'Out of Stock', value: outOfStockCount.toString(), icon: Package, color: 'bg-rose-50 text-rose-600' },
          { label: 'Low Stock SKUs', value: lowStockCount.toString(), icon: AlertCircle, color: 'bg-blue-50 text-blue-600' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm"
          >
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4", stat.color)}>
              <stat.icon size={24} />
            </div>
            <p className="text-zinc-500 text-sm font-medium">{stat.label}</p>
            <p className="text-2xl font-bold text-zinc-900">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm min-h-[300px]">
        <h2 className="text-lg font-bold mb-4">Recent Activity</h2>
        <div className="space-y-4">
          {[1, 2, 3].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
              <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center">
                <ShoppingCart size={18} className="text-zinc-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Order #ORD-2024-00{i+1}</p>
                <p className="text-xs text-zinc-500">Retailer: Krishna General Store</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">₹4,250</p>
                <p className="text-[10px] text-emerald-600 font-bold uppercase">Delivered</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [companies, setCompanies] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  const [collections, setCollections] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);

  // Sync data from Firestore
  useEffect(() => {
    if (!user) return;

    const collectionsToSync = [
      { key: 'companies', setter: setCompanies },
      { key: 'suppliers', setter: setSuppliers },
      { key: 'products', setter: setProducts },
      { key: 'customers', setter: setCustomers },
      { key: 'orders', setter: setOrders },
      { key: 'movements', setter: setMovements },
      { key: 'collections', setter: setCollections }
    ];

    const unsubscribes = collectionsToSync.map(({ key, setter }) => {
      return onSnapshot(collection(db, key), (snapshot) => {
        if (snapshot.empty) {
          bootstrapData(key);
        } else {
          setter(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
        }
      }, (error) => {
        console.error(`Error syncing ${key}:`, error);
      });
    });

    // Sync profile
    const unsubProfile = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        setProfile(snapshot.data() as UserProfile);
      }
    }, (error) => {
      console.error("Error syncing profile:", error);
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
      unsubProfile();
    };
  }, [user]);

  const bootstrapData = async (key: string) => {
    const initialData: any = {
      companies: [
        { id: 'COMP-001', name: 'Hindustan Unilever Ltd', code: 'HUL', type: 'Principal', status: 'Active' },
        { id: 'COMP-002', name: 'ITC Limited', code: 'ITC', type: 'Principal', status: 'Active' },
        { id: 'COMP-003', name: 'Amul (GCMMF)', code: 'AMUL', type: 'Principal', status: 'Active' },
        { id: 'COMP-004', name: 'Britannia Industries', code: 'BRIT', type: 'Principal', status: 'Active' },
      ],
      suppliers: [
        { id: 'SUP-001', name: 'Hindustan Unilever Ltd', code: 'HUL', type: 'Principal', gstin: '27AAACH1234H1Z1', depot: 'DEP-MUM-01', asm: 'Vikram Singh', contact: '+91 98765 43210' },
        { id: 'SUP-002', name: 'ITC Limited', code: 'ITC', type: 'Principal', gstin: '27AAACI5678I1Z2', depot: 'DEP-PUN-02', asm: 'Neha Sharma', contact: '+91 98765 43211' },
        { id: 'SUP-003', name: 'Amul (GCMMF)', code: 'AMUL', type: 'Principal', gstin: '24AAACG9012G1Z3', depot: 'DEP-GUJ-03', asm: 'Rohan Mehta', contact: '+91 98765 43212' },
      ],
      products: [
        { 
          sku: 'HUL-001', 
          name: 'Surf Excel Easy Wash 1kg', 
          brand: 'HUL', 
          stock: 450, 
          ptr: 120, 
          pts: 110,
          mrp: 145,
          distributorPrice: 115,
          wholesalerPrice: 125,
          retailerPrice: 135,
          category: 'Laundry',
          subCategory: 'Detergent Powder',
          variant: '1kg Pack',
          hsn: '34011110',
          gstRate: 18,
          caseSize: 24,
          moq: 12,
          reorderLevel: 200,
          shelfLife: '24 Months',
          barcode: '8901030678123',
          isActive: true,
          description: 'Surf Excel Easy Wash has the power of 10 hands that removes tough stains easily. It is a superfine powder that dissolves easily and removes tough stains fast.',
          batches: [
            { number: 'BN-2024-001', expiry: '2025-12-31', qty: 250, location: 'Main Warehouse' },
            { number: 'BN-2024-005', expiry: '2025-06-15', qty: 200, location: 'Secondary Godown' },
          ]
        },
        { 
          sku: 'ITC-001', 
          name: 'Aashirvaad Atta 5kg', 
          brand: 'ITC', 
          stock: 120, 
          ptr: 240, 
          pts: 220,
          mrp: 285,
          distributorPrice: 230,
          wholesalerPrice: 250,
          retailerPrice: 265,
          category: 'Foods',
          subCategory: 'Staples',
          variant: '5kg Bag',
          hsn: '11010000',
          gstRate: 5,
          caseSize: 4,
          moq: 4,
          reorderLevel: 150,
          shelfLife: '6 Months',
          barcode: '8901725123456',
          isActive: true,
          description: 'Aashirvaad Whole Wheat Atta is made from the grains which are heavy on the palm, golden in colour and hard in bite. It is ground using modern chakki process.',
          batches: [
            { number: 'BN-2024-002', expiry: '2025-10-20', qty: 120, location: 'Main Warehouse' },
          ]
        },
        { 
          sku: 'AMUL-001', 
          name: 'Amul Butter 500g', 
          brand: 'Amul', 
          stock: 300, 
          ptr: 245, 
          pts: 235,
          mrp: 275,
          distributorPrice: 238,
          wholesalerPrice: 255,
          retailerPrice: 265,
          category: 'Dairy',
          subCategory: 'Butter',
          variant: '500g Block',
          hsn: '04051000',
          gstRate: 12,
          caseSize: 20,
          moq: 10,
          reorderLevel: 100,
          shelfLife: '12 Months',
          barcode: '8901262010012',
          isActive: true,
          description: 'Amul Butter is made from fresh cream and has a rich, creamy taste. It is a staple in Indian households.',
          batches: [
            { number: 'BN-2024-009', expiry: '2024-12-31', qty: 300, location: 'Main Warehouse' },
          ]
        },
        { 
          sku: 'HUL-002', 
          name: 'Dove Cream Bar 75g', 
          brand: 'HUL', 
          stock: 800, 
          ptr: 45, 
          pts: 41,
          mrp: 55,
          distributorPrice: 43,
          wholesalerPrice: 48,
          retailerPrice: 52,
          category: 'Personal Care',
          subCategory: 'Soap',
          variant: '75g Bar',
          hsn: '34011110',
          gstRate: 18,
          caseSize: 48,
          moq: 48,
          reorderLevel: 300,
          shelfLife: '36 Months',
          barcode: '8901030123456',
          isActive: true,
          description: 'Dove Beauty Bar combines a gentle cleansing formula with Doves signature 1/4 moisturizing cream to give you softer, smoother, more radiant looking skin.',
          batches: [
            { number: 'BN-2024-003', expiry: '2026-01-15', qty: 800, location: 'Main Warehouse' },
          ],
          isSerialized: true,
          serialNumbers: ['SN-HUL-002-001', 'SN-HUL-002-002', 'SN-HUL-002-003']
        },
        { 
          sku: 'ITC-002', 
          name: 'Sunfeast Dark Fantasy 75g', 
          brand: 'ITC', 
          stock: 15, 
          ptr: 30, 
          pts: 27,
          mrp: 40,
          distributorPrice: 28,
          wholesalerPrice: 32,
          retailerPrice: 36,
          category: 'Snacks',
          subCategory: 'Biscuits',
          variant: '75g Pack',
          hsn: '19053100',
          gstRate: 18,
          caseSize: 60,
          moq: 30,
          reorderLevel: 100,
          shelfLife: '9 Months',
          barcode: '8901725123789',
          isActive: true,
          description: 'Sunfeast Dark Fantasy Choco Fills is a unique combination of crunchy chocolate cookie and a core of molten chocolate. It is a treat for chocolate lovers.',
          batches: [
            { number: 'BN-2024-004', expiry: '2024-12-01', qty: 15, location: 'Sales Van 01' },
          ]
        },
      ],
      customers: [
        { 
          id: 'C-001', 
          name: 'Krishna General Store', 
          ownerName: 'Rajesh Gupta',
          type: 'Retailer', 
          outstanding: 12500, 
          limit: 50000, 
          creditPeriod: 15,
          paymentTerms: 'Net 15',
          gstNumber: '27AAACR1234A1Z5',
          pan: 'ABCDE1234F',
          address: 'Shop 12, Market Road, Mumbai',
          gps: '19.0760, 72.8777',
          beat: 'Beat 01',
          route: 'East Mumbai Route A',
          salesRep: 'Rahul Sharma',
          bankDetails: 'HDFC Bank - 50100123456789',
          kycStatus: 'Verified',
          codes: { HUL: 'HUL-C-992', ITC: 'ITC-C-102', AMUL: 'AMUL-C-44' }
        },
        { 
          id: 'C-002', 
          name: 'City Wholesalers', 
          ownerName: 'Amit Patel',
          type: 'Wholesaler', 
          outstanding: 85000, 
          limit: 200000, 
          creditPeriod: 30,
          paymentTerms: 'Net 30',
          gstNumber: '27BBBCR5678B1Z2',
          pan: 'FGHIJ5678K',
          address: 'Warehouse 4, Industrial Area, Mumbai',
          gps: '19.1136, 72.8697',
          beat: 'Beat 04',
          route: 'Industrial Belt B',
          salesRep: 'Amit Patel',
          bankDetails: 'ICICI Bank - 000123456789',
          kycStatus: 'Verified',
          codes: { HUL: 'HUL-C-105', ITC: 'ITC-C-88', AMUL: 'AMUL-C-12' }
        },
        { 
          id: 'C-003', 
          name: 'Modern Retail Hub', 
          ownerName: 'Suresh Kumar',
          type: 'Both', 
          outstanding: 0, 
          limit: 30000, 
          creditPeriod: 7,
          paymentTerms: 'COD',
          gstNumber: '27CCCCR9012C1Z3',
          pan: 'LMNOP9012Q',
          address: 'Suite 101, Business Center, Mumbai',
          gps: '19.0330, 72.8515',
          beat: 'Beat 01',
          route: 'East Mumbai Route A',
          salesRep: 'Rahul Sharma',
          bankDetails: 'SBI - 12345678901',
          kycStatus: 'Pending',
          codes: { HUL: 'HUL-C-201', ITC: 'ITC-C-55', AMUL: 'AMUL-C-09' }
        },
      ],
      orders: [
        { id: 'ORD-001', customer: 'Krishna Stores', amount: 12500, status: 'Delivered', workflow: 'Completed', channel: 'Mobile App', date: '2024-03-20', items: [{ sku: 'HUL-001', qty: 10, price: 120 }] },
        { id: 'ORD-002', customer: 'City Wholesalers', amount: 45000, status: 'Pending', workflow: 'Credit Check', channel: 'Web Portal', date: '2024-03-21', items: [{ sku: 'ITC-001', qty: 50, price: 240 }] },
        { id: 'ORD-003', customer: 'Modern Retail Hub', amount: 8200, status: 'Dispatched', workflow: 'In Transit', channel: 'Mobile App', date: '2024-03-22', items: [{ sku: 'HUL-002', qty: 20, price: 45 }] },
        { id: 'ORD-004', customer: 'Sai Provisions', amount: 55000, status: 'On Hold', workflow: 'Manager Approval', channel: 'Excel Upload', date: '2024-03-22', items: [{ sku: 'ITC-001', qty: 100, price: 240 }] },
      ],
      movements: [
        { id: 'GRN-001', sku: 'HUL-001', name: 'Surf Excel Easy Wash 1kg', type: 'grn', qty: 200, reason: 'GRN Inward to Main Warehouse', date: '2026-04-07 14:30' },
        { id: 'TRF-001', sku: 'ITC-001', name: 'Aashirvaad Atta 5kg', type: 'transfer', qty: 24, reason: 'Transfer: Main Warehouse -> Sales Van 01', date: '2026-04-07 11:15' },
        { id: 'ADJ-001', sku: 'HUL-002', name: 'Dove Cream Bar 75g', type: 'adjustment', qty: -5, reason: 'Adjustment: Damaged (Approved by Rajesh M.)', date: '2026-04-06 16:45' },
        { id: 'ORD-102', sku: 'ITC-002', name: 'Sunfeast Dark Fantasy 75g', type: 'outward', qty: -10, reason: 'Sales Order Delivery', date: '2026-04-06 10:00' },
      ],
      collections: []
    };

    if (initialData[key]) {
      for (const item of initialData[key]) {
        const id = item.id || item.sku;
        const docRef = doc(db, key, id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          await setDoc(docRef, item);
        }
      }
    }
  };

  const handleRecordPayment = async (payment: any) => {
    try {
      const paymentId = `PAY-${Math.floor(Math.random() * 10000)}`;
      await setDoc(doc(db, 'collections', paymentId), { ...payment, id: paymentId });
      
      const customer = customers.find(c => c.id === payment.customerId);
      if (customer) {
        await updateDoc(doc(db, 'customers', customer.id), {
          outstanding: Math.max(0, (customer.outstanding || 0) - payment.amount)
        });
      }
      toast.success('Payment recorded successfully');
    } catch (error) {
      console.error("Payment recording error:", error);
      toast.error("Failed to record payment");
    }
  };

  const handleUpdateStock = async (sku: string, qtyChange: number, batchData?: any) => {
    const product = products.find(p => p.sku === sku);
    if (product) {
      let updatedBatches = [...(product.batches || [])];
      
      if (qtyChange > 0) {
        if (batchData) {
          updatedBatches.push({
            ...batchData,
            qty: Number(batchData.qty || qtyChange)
          });
        }
      } else if (qtyChange < 0) {
        let remainingToDeduct = Math.abs(qtyChange);
        updatedBatches.sort((a, b) => {
          const dateA = new Date(a.expiry || a.expiryDate).getTime();
          const dateB = new Date(b.expiry || b.expiryDate).getTime();
          return dateA - dateB;
        });
        
        updatedBatches = updatedBatches.map(batch => {
          if (remainingToDeduct > 0 && batch.qty > 0) {
            const deduction = Math.min(batch.qty, remainingToDeduct);
            remainingToDeduct -= deduction;
            return { ...batch, qty: batch.qty - deduction };
          }
          return batch;
        }).filter(batch => batch.qty > 0);
      }

      await updateDoc(doc(db, 'products', sku), {
        stock: Math.max(0, product.stock + qtyChange),
        batches: updatedBatches
      });
    }
  };

  const handleAddOrder = async (newOrder: any) => {
    try {
      await setDoc(doc(db, 'orders', newOrder.id), newOrder);
      
      for (const item of newOrder.items) {
        await handleUpdateStock(item.sku || item.id, -item.qty);
        
        const movementId = `MOV-${Math.floor(Math.random() * 10000)}`;
        await setDoc(doc(db, 'movements', movementId), {
          id: movementId,
          sku: item.sku || item.id,
          name: item.name,
          type: 'outward',
          qty: -item.qty,
          reason: `Sales Order: ${newOrder.id}`,
          date: new Date().toISOString().replace('T', ' ').substring(0, 16)
        });
      }
    } catch (error) {
      console.error("Order addition error:", error);
      toast.error("Failed to add order");
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    try {
      await updateDoc(doc(db, 'orders', orderId), { status: 'Cancelled', workflow: 'Cancelled' });
      
      for (const item of order.items) {
        await handleUpdateStock(item.sku || item.id, item.qty);
        
        const movementId = `MOV-${Math.floor(Math.random() * 10000)}`;
        await setDoc(doc(db, 'movements', movementId), {
          id: movementId,
          sku: item.sku || item.id,
          name: item.name,
          type: 'inward',
          qty: item.qty,
          reason: `Order Cancelled: ${orderId}`,
          date: new Date().toISOString().replace('T', ' ').substring(0, 16)
        });
      }
      toast.success('Order cancelled and stock reversed');
    } catch (error) {
      console.error("Order cancellation error:", error);
      toast.error("Failed to cancel order");
    }
  };

  const handleUpdateStockWithLog = async (sku: string, qtyChange: number, batchData?: any, reason?: string) => {
    await handleUpdateStock(sku, qtyChange, batchData);
    const product = products.find(p => p.sku === sku);
    if (product) {
      const movementId = `MOV-${Math.floor(Math.random() * 10000)}`;
      await setDoc(doc(db, 'movements', movementId), {
        id: movementId,
        sku: sku,
        name: product.name,
        type: qtyChange > 0 ? 'inward' : 'outward',
        qty: qtyChange,
        reason: reason || (qtyChange > 0 ? 'Manual Stock Addition' : 'Manual Stock Adjustment'),
        date: new Date().toISOString().replace('T', ' ').substring(0, 16)
      });
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Super Admin', 'Distribution Manager', 'Sales Manager', 'MIS Analyst'] },
    { id: 'sales_app', label: 'Sales App (Mobile)', icon: Truck, roles: ['Super Admin', 'Sales Representative'] },
    { id: 'orders', label: 'Order Management', icon: ShoppingCart, roles: ['Super Admin', 'Distribution Manager', 'Sales Manager', 'Accounts Executive'] },
    { id: 'approvals', label: 'Approvals', icon: ShieldCheck, roles: ['Super Admin', 'Distribution Manager', 'Sales Manager'] },
    { id: 'inventory', label: 'Products', icon: Package, roles: ['Super Admin', 'Distribution Manager', 'Warehouse Manager'] },
    { id: 'customers', label: 'Customers', icon: Users, roles: ['Super Admin', 'Distribution Manager', 'Sales Manager'] },
    { id: 'suppliers', label: 'Suppliers', icon: ShieldCheck, roles: ['Super Admin', 'Distribution Manager'] },
    { id: 'geo', label: 'Geography', icon: MapPin, roles: ['Super Admin', 'Distribution Manager'] },
    { id: 'companies', label: 'Companies', icon: Building2, roles: ['Super Admin'] },
    { id: 'warehouse', label: 'Warehouse', icon: Warehouse, roles: ['Super Admin', 'Warehouse Manager', 'Warehouse Operator'] },
    { id: 'movements', label: 'Stock Movement', icon: History, roles: ['Super Admin', 'Warehouse Manager', 'Warehouse Operator'] },
    { id: 'picking', label: 'Picking List', icon: ClipboardList, roles: ['Super Admin', 'Warehouse Manager', 'Warehouse Operator'] },
    { id: 'returns', label: 'Returns & Damage', icon: ArrowLeftRight, roles: ['Super Admin', 'Warehouse Manager', 'Accounts Executive', 'Sales Manager'] },
    { id: 'schemes', label: 'Schemes', icon: Tag, roles: ['Super Admin', 'Distribution Manager', 'Sales Manager'] },
    { id: 'compliance', label: 'Compliance', icon: ShieldCheck, roles: ['Super Admin', 'Accounts Executive'] },
    { id: 'reports', label: 'Reports & Analytics', icon: TrendingUp, roles: ['Super Admin', 'Distribution Manager', 'Sales Manager', 'MIS Analyst'] },
    { id: 'analytics', label: 'Performance', icon: TrendingUp, roles: ['Super Admin', 'Distribution Manager', 'Sales Manager', 'MIS Analyst'] },
    { id: 'notifications', label: 'Notifications', icon: Bell, roles: ['Super Admin', 'Distribution Manager', 'Sales Manager', 'Warehouse Manager', 'Accounts Executive', 'MIS Analyst'] },
    { id: 'beats', label: 'Beats', icon: MapPin, roles: ['Super Admin', 'Sales Manager'] },
    { id: 'users', label: 'User Management', icon: UserCog, roles: ['Super Admin'] },
  ];

  const filteredNavItems = React.useMemo(() => {
    return navItems.filter(item => {
      if (!profile) return item.id === 'dashboard'; 
      if (profile.role === 'Super Admin') return true;
      return item.roles.includes(profile.role);
    });
  }, [profile]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      try {
        setUser(u);
        if (u) {
          const userRef = doc(db, 'users', u.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const data = userSnap.data() as UserProfile;
            if (u.email === "mrwater.prov1@gmail.com" && data.role !== 'Super Admin') {
              await updateDoc(userRef, { role: 'Super Admin' });
              setProfile({ ...data, role: 'Super Admin' });
            } else {
              setProfile(data);
            }
          } else if (u.email === "mrwater.prov1@gmail.com") {
            const newProfile = {
              uid: u.uid,
              name: u.displayName || 'Super Admin',
              email: u.email,
              role: 'Super Admin',
              isActive: true,
              companyId: 'COMP-001',
              createdAt: new Date().toISOString()
            };
            await setDoc(userRef, newProfile);
            setProfile(newProfile as UserProfile);
          } else {
            setProfile(null);
          }
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error("Auth state change error:", error);
        toast.error("Failed to load user profile");
      } finally {
        setLoading(false);
      }
    });

    // Safety timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 8000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (profile && !filteredNavItems.find(item => item.id === activeTab)) {
      setActiveTab(filteredNavItems[0]?.id || 'dashboard');
    }
  }, [profile, filteredNavItems, activeTab]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        className="w-10 h-10 border-4 border-zinc-900 border-t-transparent rounded-full"
      />
    </div>
  );

  if (!user) return <Login />;

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col md:flex-row">
      <Toaster position="top-center" richColors />
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-zinc-200 p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <TrendingUp className="text-zinc-900" />
          <span className="font-bold text-xl">DMS Pro</span>
        </div>
        <button onClick={() => setSidebarOpen(true)} className="p-2 text-zinc-600">
          <Menu size={24} />
        </button>
      </div>

      {/* Sidebar */}
      <AnimatePresence>
        {(sidebarOpen || (typeof window !== 'undefined' && window.innerWidth >= 768)) && (
          <motion.aside 
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className={cn(
              "fixed md:sticky top-0 left-0 h-screen w-72 bg-white border-r border-zinc-200 z-[60] p-6 flex flex-col transition-all duration-300",
              !sidebarOpen && "hidden md:flex"
            )}
          >
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center">
                  <TrendingUp className="text-white" size={20} />
                </div>
                <span className="font-bold text-xl">DMS Pro</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="md:hidden p-2">
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 space-y-2">
              {filteredNavItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all",
                    activeTab === item.id 
                      ? "bg-zinc-900 text-white shadow-lg shadow-zinc-200" 
                      : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                  )}
                >
                  <item.icon size={20} />
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="mt-auto pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-3 mb-6 px-2">
                <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center font-bold text-zinc-600">
                  {profile?.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{profile?.name}</p>
                  <p className="text-xs text-zinc-500 capitalize">{profile?.role}</p>
                </div>
              </div>
              <button 
                onClick={() => auth.signOut()}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-all"
              >
                <LogOut size={20} />
                Logout
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        <header className="mb-8 hidden md:block">
          <h1 className="text-3xl font-bold text-zinc-900 capitalize">{activeTab.replace('_', ' ')}</h1>
          <p className="text-zinc-500">Welcome back, {profile?.name}</p>
        </header>

        {activeTab === 'dashboard' && <Dashboard products={products} orders={orders} />}
        {activeTab === 'sales_app' && <SalesRepMobileView onRecordPayment={handleRecordPayment} customers={customers} products={products} />}
        {activeTab === 'orders' && <OrdersView orders={orders} products={products} onAddOrder={handleAddOrder} onCancelOrder={handleCancelOrder} />}
        {activeTab === 'approvals' && <ApprovalsView orders={orders} />}
        {activeTab === 'inventory' && <InventoryView products={products} onUpdateStock={handleUpdateStockWithLog} onAddProduct={async (p) => {
          try {
            await setDoc(doc(db, 'products', p.sku), p);
            toast.success('Product added successfully');
          } catch (error) {
            toast.error('Failed to add product');
          }
        }} companies={companies} />}
        {activeTab === 'customers' && <CustomersView customers={customers} setCustomers={async (c) => {
          // In a real app we'd have a proper handleAddCustomer
        }} />}
        {activeTab === 'suppliers' && <SupplierView suppliers={suppliers} setSuppliers={async (s) => {}} />}
        {activeTab === 'geo' && <GeographicView />}
        {activeTab === 'companies' && <CompanyView companies={companies} setCompanies={async (c) => {}} />}
        {activeTab === 'warehouse' && <WarehouseManagementView products={products} onUpdateStock={handleUpdateStockWithLog} />}
        {activeTab === 'movements' && <StockMovementView movements={movements} />}
        {activeTab === 'picking' && <PickingListView orders={orders} />}
        {activeTab === 'schemes' && <SchemeManagementView />}
        {activeTab === 'compliance' && <ComplianceView />}
        {activeTab === 'analytics' && <AnalyticsView />}
        {activeTab === 'notifications' && <NotificationsView />}
        {activeTab === 'beats' && <BeatsView />}
        {activeTab === 'users' && <UserManagementView />}
        {activeTab === 'returns' && <ReturnsView products={products} onUpdateStock={handleUpdateStockWithLog} />}
        {activeTab === 'reports' && <ReportsView products={products} />}
      </main>
    </div>
  );
}
