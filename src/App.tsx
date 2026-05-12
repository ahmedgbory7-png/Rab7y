import { useState, useEffect, useMemo, ReactNode } from 'react';
import { 
  Calculator, 
  ArrowRight,
  Plus, 
  ChevronRight,
  TrendingUp, 
  TrendingDown,
  Minus,
  Home,
  Package, 
  Settings, 
  ChevronLeft, 
  Wallet, 
  BarChart3, 
  History, 
  Crown, 
  HeadphonesIcon, 
  RefreshCw, 
  Database,
  ArrowRightLeft,
  X,
  MessageSquare,
  LogIn,
  LogOut,
  User,
  Star,
  Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ItemType, Currency, Product, SubscriptionTier } from './types';
import { 
  DEFAULT_EXCHANGE_RATES, 
  CURRENCY_SYMBOLS, 
  CURRENCY_NAMES, 
  PRO_UNLOCK_CODE, 
  FREE_TRIAL_LIMIT, 
  WHATSAPP_NUMBER, 
  WHATSAPP_CONTACT_NAME 
} from './constants';

import { auth, db } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  signInAnonymously,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy,
  getDoc
} from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errText = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errText,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  if (errText.includes('insufficient permissions')) {
    alert('عذراً، ليس لديك الصلاحية للقيام بهذا الإجراء. يرجى التأكد من تسجيل الدخول.');
  } else if (errText.includes('offline')) {
    alert('يرجى التحقق من اتصالك بالإنترنت والاتصال بالسحابة.');
  } else {
    alert(`حدث خطأ في قاعدة البيانات: ${errText}`);
  }
}

type Screen = 'dashboard' | 'add' | 'settings';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [addingType, setAddingType] = useState<ItemType>(ItemType.PRODUCT);
  const [products, setProducts] = useState<Product[]>([]);
  const [currency, setCurrency] = useState<Currency>(Currency.IQD);
  const [tier, setTier] = useState<SubscriptionTier>(SubscriptionTier.FREE);
  const [username, setUsername] = useState<string>('');
  const [showProModal, setShowProModal] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [proCode, setProCode] = useState('');
  const [activatingTier, setActivatingTier] = useState<SubscriptionTier | null>(null);
  const [activationInput, setActivationInput] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'profit'>('date');

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Sync Data on Login/Logout
  useEffect(() => {
    if (user) {
      // User signed in - load states from Firestore via other effects
    } else {
      // User signed out or not logged in - load from LocalStorage
      const localProds = localStorage.getItem('rabihy_products');
      if (localProds) setProducts(JSON.parse(localProds));

      const localSettings = localStorage.getItem('rabihy_settings');
      if (localSettings) {
        const data = JSON.parse(localSettings);
        if (data.currency) setCurrency(data.currency as Currency);
        if (data.tier) setTier(data.tier as SubscriptionTier);
        if (data.username) setUsername(data.username as string);
      }
    }
  }, [user]);

  // Sync Products from Firestore
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'users', user.uid, 'products'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(prods);
      // Cache locally as well
      localStorage.setItem('rabihy_products', JSON.stringify(prods));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/products`));

    return () => unsubscribe();
  }, [user]);

  // Sync Settings from Firestore
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid, 'settings', 'state'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.currency) setCurrency(data.currency as Currency);
        if (data.tier) setTier(data.tier as SubscriptionTier);
        if (data.username) setUsername(data.username as string);
        
        // Cache locally
        localStorage.setItem('rabihy_settings', JSON.stringify({
          currency: data.currency,
          tier: data.tier,
          username: data.username
        }));
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}/settings/state`));

    return () => unsubscribe();
  }, [user]);

  // Handle Login
  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
      alert("فشل تسجيل الدخول. يرجى المحاولة مرة أخرى.");
    }
  };

  // Handle Logout
  const getWhatsAppUrl = (message?: string) => {
    const cleanNumber = WHATSAPP_NUMBER.startsWith('0') ? WHATSAPP_NUMBER.slice(1) : WHATSAPP_NUMBER;
    const baseUrl = `https://wa.me/964${cleanNumber}`;
    return message ? `${baseUrl}?text=${encodeURIComponent(message)}` : baseUrl;
  };

  const handleLogout = async () => {
    if (confirm("هل تريد تسجيل الخروج؟ سيتم حفظ بياناتك في السحاب.")) {
      try {
        await signOut(auth);
        setUser(null);
        setScreen('dashboard');
        // Clear local storage and reset
        localStorage.removeItem('rabihy_products');
        localStorage.removeItem('rabihy_settings');
        setProducts([]);
        setCurrency(Currency.IQD);
        setTier(SubscriptionTier.FREE);
        setShowProModal(false);
        setActivatingTier(null);
        setActivationInput('');
      } catch (error) {
        console.error("Logout failed:", error);
      }
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: 'تطبيق ربحي',
      text: 'تطبيق ربحي - حاسبتك الذكية لإدارة المنتجات والأرباح في العراق.',
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error: any) {
        if (error.name === 'AbortError') {
          // User cancelled, which is fine. No need to log as error.
          return;
        }
        
        console.error('Error sharing', error);
        // Fallback to clipboard if share failed for other reasons
        try {
          await navigator.clipboard.writeText(shareData.url);
          alert('تم نسخ رابط التطبيق!');
        } catch (clipErr) {
          console.error('Clipboard fallback failed', clipErr);
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert('تم نسخ رابط التطبيق! يمكنك مشاركته الآن.');
      } catch (err) {
        console.error('Failed to copy link', err);
      }
    }
  };

  const updateRemoteSettings = async (newCurrency: Currency, newTier: SubscriptionTier, newUsername: string = username) => {
    // Save to LocalStorage first
    localStorage.setItem('rabihy_settings', JSON.stringify({
      currency: newCurrency,
      tier: newTier,
      username: newUsername
    }));

    if (!auth.currentUser) return;
    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid, 'settings', 'state'), {
        currency: newCurrency,
        tier: newTier,
        username: newUsername,
        userId: auth.currentUser.uid
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${auth.currentUser.uid}/settings/state`);
    }
  };

  const handleCurrencyChange = (c: Currency) => {
    setCurrency(c);
    updateRemoteSettings(c, tier, username);
  };

  const handleUsernameChange = (name: string) => {
    setUsername(name);
    updateRemoteSettings(currency, tier, name);
  };

  const convertValue = (val: number) => {
    return val * DEFAULT_EXCHANGE_RATES[currency];
  };

  const formatCurrency = (val: number) => {
    const converted = convertValue(val);
    const isIQD = currency === Currency.IQD;
    const options: Intl.NumberFormatOptions = { 
      maximumFractionDigits: isIQD ? 0 : 2,
      minimumFractionDigits: isIQD ? 0 : 2
    };
    return `${converted.toLocaleString('en-US', options)} ${CURRENCY_SYMBOLS[currency]}`;
  };

  // Calculations
  const stats = useMemo(() => {
    const mostProfitable = [...products].sort((a, b) => {
      const profitPerA = a.itemType === ItemType.BOX 
        ? (a.sellingPrice - (a.purchasePrice / a.quantity))
        : (a.sellingPrice - a.purchasePrice - a.expenses);
      const profitA = profitPerA * a.quantity;

      const profitPerB = b.itemType === ItemType.BOX 
        ? (b.sellingPrice - (b.purchasePrice / b.quantity))
        : (b.sellingPrice - b.purchasePrice - b.expenses);
      const profitB = profitPerB * b.quantity;
      
      return profitB - profitA;
    })[0];

    return { mostProfitable };
  }, [products]);

  const sortedAndFilteredProducts = useMemo(() => {
    return products
      .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'profit') {
          const getProfit = (item: Product) => {
            const profitPer = item.itemType === ItemType.BOX 
              ? (item.sellingPrice - (item.purchasePrice / item.quantity))
              : (item.sellingPrice - item.purchasePrice - item.expenses);
            return profitPer * item.quantity;
          };
          return getProfit(b) - getProfit(a);
        }
        return b.createdAt - a.createdAt; // Default: 'date' (Newest first)
      });
  }, [products, searchQuery, sortBy]);

  const handleAddProduct = async (p: Omit<Product, 'id' | 'createdAt'>) => {
    const limit = tier === SubscriptionTier.FREE ? 3 : tier === SubscriptionTier.BASIC ? 20 : tier === SubscriptionTier.GOLD ? 100 : Infinity;
    if (products.length >= limit) {
      setShowProModal(true);
      return;
    }

    const productId = Math.random().toString(36).substr(2, 9);
    const newProduct = {
      ...p,
      id: productId,
      createdAt: Date.now(),
      userId: auth.currentUser?.uid || 'guest'
    };

    if (!auth.currentUser) {
      const updatedProducts = [newProduct as Product, ...products];
      setProducts(updatedProducts);
      localStorage.setItem('rabihy_products', JSON.stringify(updatedProducts));
      setScreen('dashboard');
      return;
    }

    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid, 'products', productId), {
        ...p,
        createdAt: newProduct.createdAt,
        userId: auth.currentUser.uid
      });
      setScreen('dashboard');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${auth.currentUser.uid}/products/${productId}`);
    }
  };

  const handleUpdateProduct = async (id: string, updatedFields: Omit<Product, 'id' | 'createdAt'>) => {
    if (!auth.currentUser) {
      const updatedProducts = products.map(p => p.id === id ? { ...p, ...updatedFields } : p);
      setProducts(updatedProducts);
      localStorage.setItem('rabihy_products', JSON.stringify(updatedProducts));
      setEditingProduct(null);
      setScreen('dashboard');
      return;
    }

    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid, 'products', id), {
        ...updatedFields,
        createdAt: Date.now(),
        userId: auth.currentUser.uid
      }, { merge: true });
      setEditingProduct(null);
      setScreen('dashboard');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${auth.currentUser.uid}/products/${id}`);
    }
  };

  const startEditing = (p: Product) => {
    setEditingProduct(p);
    setScreen('add');
  };

  const handleUnlockPro = (selectedTier: SubscriptionTier, code: string) => {
    const validCodes: Record<SubscriptionTier, string> = {
      [SubscriptionTier.PREMIUM]: '9090',
      [SubscriptionTier.BASIC]: '0009',
      [SubscriptionTier.GOLD]: '9000',
      [SubscriptionTier.FREE]: '',
    };

    if (code === validCodes[selectedTier] || code === '0099') {
      setTier(selectedTier);
      updateRemoteSettings(currency, selectedTier);
      setShowProModal(false);
      setProCode('');
      setActivatingTier(null);
      setActivationInput('');
      alert(`تم تفعيل الاشتراك تم بنجاح!`);
    } else {
      alert('الكود غير صحيح. يرجى التواصل مع الدعم الفني.');
    }
  };

  const deleteProduct = async (id: string) => {
    if (!auth.currentUser) {
      const updatedProducts = products.filter(p => p.id !== id);
      setProducts(updatedProducts);
      localStorage.setItem('rabihy_products', JSON.stringify(updatedProducts));
      if (editingProduct?.id === id) {
        setEditingProduct(null);
        setScreen('dashboard');
      }
      setConfirmDeleteId(null);
      return;
    }
    
    const currentUser = auth.currentUser;
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'products', id));
      
      if (editingProduct?.id === id) {
        setEditingProduct(null);
        setScreen('dashboard');
      }
      
      setConfirmDeleteId(null);
      // OnSnapshot will update UI
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${currentUser.uid}/products/${id}`);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a1510] flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1510] font-sans text-white pb-28" dir="rtl">
      {/* Header */}
      <header className="bg-[#0d1f18] text-white p-6 rounded-b-[2.5rem] shadow-2xl sticky top-0 z-10 overflow-hidden border-b border-emerald-900/30">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
        <div className="relative flex justify-between items-center">
          <div className="flex items-center gap-3">
            {screen !== 'dashboard' && (
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setScreen('dashboard');
                  setEditingProduct(null);
                }}
                className="bg-emerald-500/10 p-3 rounded-2xl backdrop-blur-md ring-1 ring-emerald-500/30 hover:bg-emerald-500/20 transition-all ml-4 group flex items-center gap-2"
              >
                <ArrowRight className="text-emerald-400 group-hover:-translate-x-1 transition-transform" size={22} />
                <span className="text-[10px] font-black uppercase text-emerald-400">رجوع</span>
              </motion.button>
            )}
            <div className="bg-white/10 p-2.5 rounded-2xl backdrop-blur-md ring-1 ring-white/20">
              <Calculator className="text-emerald-400" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight leading-none mb-1">
                ربحي
              </h1>
              <p className="text-emerald-300/80 text-[10px] font-bold uppercase tracking-widest">
                حاسبة أرباح المحل
              </p>
            </div>
          </div>
          {tier !== SubscriptionTier.FREE && (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`flex items-center gap-1.5 bg-gradient-to-r ${tier === SubscriptionTier.PREMIUM ? 'from-amber-500 to-amber-600' : 'from-blue-500 to-blue-600'} text-white px-4 py-1.5 rounded-full text-[10px] font-black shadow-lg ring-2 ring-white/10`}
            >
              <Crown size={14} className="fill-white" />
              <span>{tier === SubscriptionTier.PREMIUM ? 'نسخة بريميوم' : tier === SubscriptionTier.GOLD ? 'نسخة جولد' : 'نسخة بيسك'}</span>
            </motion.div>
          )}
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        <AnimatePresence mode="wait">
          {screen === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Profit Ticker */}
              <ProfitTicker products={products} formatCurrency={formatCurrency} />

              {/* Most Profitable Card */}
              {stats.mostProfitable && (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-gradient-to-br from-[#122b22] to-[#0a1510] text-emerald-50 p-6 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.4)] relative overflow-hidden group border border-emerald-500/20"
                >
                  <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-emerald-500/5 to-transparent"></div>
                  <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl transition-transform group-hover:scale-150 duration-700"></div>
                  <div className="relative">
                    <div className="flex justify-between items-start mb-4">
                      <span className="bg-emerald-500/20 text-emerald-400 px-3.5 py-1 rounded-full text-[10px] uppercase font-black tracking-widest ring-1 ring-emerald-500/30">
                        الأكثر ربحاً
                      </span>
                      <BarChart3 size={20} className="text-emerald-500/40" />
                    </div>
                    <h3 className="text-2xl font-black mb-1">{stats.mostProfitable.name}</h3>
                    <div className="flex justify-between items-end mt-4">
                      <div>
                        <p className="text-emerald-500/40 text-[10px] font-bold uppercase tracking-widest mb-1 leading-none">إجمالي الأرباح</p>
                        <p className="text-3xl font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                          {(() => {
                            const p = stats.mostProfitable;
                            const profitPer = p.itemType === ItemType.BOX 
                              ? (p.sellingPrice - (p.purchasePrice / p.quantity))
                              : (p.sellingPrice - p.purchasePrice - p.expenses);
                            return formatCurrency(profitPer * p.quantity);
                          })()}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-emerald-500/30">
                        <Wallet className="text-emerald-400" size={24} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Products List */}
              <div className="space-y-4">
                <div className="flex flex-col gap-4 px-2">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-black text-emerald-100 flex items-center gap-2">
                      <Package size={20} className="text-emerald-500" />
                      الصناديق
                    </h2>
                    {tier !== SubscriptionTier.PREMIUM && (
                      <span className="text-[10px] font-bold bg-emerald-900/40 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20">
                        {products.length} / {tier === SubscriptionTier.FREE ? 3 : tier === SubscriptionTier.BASIC ? 20 : 100} صناديق
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input 
                        type="text" 
                        placeholder="بحث عن صندوق..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#122b22]/40 border border-emerald-900/30 rounded-2xl py-3 px-4 pr-10 text-xs font-bold text-white placeholder:text-emerald-900 focus:outline-none focus:border-emerald-500 transition-all"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-900">
                        <BarChart3 size={16} className="rotate-90" />
                      </div>
                    </div>
                    <select 
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="bg-[#122b22]/40 border border-emerald-900/30 rounded-2xl px-4 py-3 text-[10px] font-black text-emerald-400 focus:outline-none focus:border-emerald-500 transition-colors appearance-none cursor-pointer"
                    >
                      <option value="date">الأحدث</option>
                      <option value="name">الاسم</option>
                      <option value="profit">الربح</option>
                    </select>
                  </div>
                </div>

                {sortedAndFilteredProducts.length === 0 ? (
                  <div className="bg-[#122b22]/30 border-2 border-dashed border-emerald-900/30 rounded-[2.5rem] py-16 px-8 text-center">
                    <div className="w-20 h-20 bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Package size={40} className="text-emerald-800" />
                    </div>
                    <h4 className="font-bold text-emerald-100 mb-2">
                      {searchQuery ? 'لا توجد نتائج للبحث' : 'لا توجد منتجات'}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {searchQuery ? 'جرب البحث عن اسم منتج آخر' : 'ابدأ بإضافة منتجاتك لمتابعة الأرباح فوراً'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sortedAndFilteredProducts.map((p, idx) => (
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        key={p.id} 
                        onClick={() => startEditing(p)}
                        className="bg-[#122b22]/40 p-4 rounded-3xl shadow-xl border border-emerald-900/20 flex items-center justify-between group hover:border-emerald-500/40 transition-all hover:bg-[#122b22]/60 cursor-pointer active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-14 h-14 bg-[#0a1510] rounded-2xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-all transform group-hover:rotate-6 shadow-inner border border-emerald-900/50 shrink-0">
                            <Package size={24} />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-black text-white leading-tight mb-1 truncate">{p.name}</h4>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-emerald-400/60 bg-emerald-950 px-2 py-0.5 rounded-md uppercase border border-emerald-900/30">
                                {p.quantity} قطعة
                              </span>
                              <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                {formatCurrency(p.sellingPrice)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-left hidden xs:flex flex-col items-end">
                            <div className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-xl border border-emerald-500/20">
                              <span className="text-[10px] font-black block leading-none mb-1 opacity-50">الربح</span>
                              <span className="text-sm font-black italic">
                                +{formatCurrency((p.sellingPrice - p.purchasePrice - p.expenses) * p.quantity)}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1.5 bg-[#0a1510]/50 p-1 rounded-2xl border border-emerald-900/30">
                             <button 
                               type="button"
                               onClick={(e) => { e.stopPropagation(); startEditing(p); }} 
                               className="p-2 text-emerald-500 hover:bg-emerald-500/20 rounded-xl transition-all active:scale-90"
                               title="تعديل"
                             >
                               <RefreshCw size={18} />
                             </button>
                             <div className="w-[1px] h-6 bg-emerald-900/30 self-center"></div>
                             <button 
                               type="button"
                               onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(p.id); }} 
                               className="p-2 text-red-500 hover:bg-red-500/20 rounded-xl transition-all active:scale-90"
                               title="حذف"
                             >
                               <X size={18} />
                             </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {screen === 'add' && (
            <motion.div
              key="add"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <ProductForm 
                onAdd={handleAddProduct} 
                onUpdate={handleUpdateProduct}
                onDelete={(id) => {
                  setConfirmDeleteId(id);
                }}
                editingProduct={editingProduct}
                cancelEdit={() => {
                  setEditingProduct(null);
                  setScreen('dashboard');
                }}
                currency={currency} 
                formatCurrency={formatCurrency} 
                initialType={addingType}
              />
            </motion.div>
          )}

          {screen === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between gap-3 mb-8">
                 <div className="flex items-center gap-3">
                   <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                     <Settings size={24} className="text-white" />
                   </div>
                   <h2 className="text-2xl font-black text-white">الإعدادات</h2>
                 </div>
                 
                 <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setScreen('dashboard')}
                    className="bg-white/5 p-3 rounded-2xl border border-white/10 text-emerald-400 flex items-center gap-2 text-xs font-black"
                 >
                    <ArrowRight size={18} />
                    <span>رجوع</span>
                 </motion.button>
              </div>
              
              <div className="space-y-3">
                <SettingsButton 
                  icon={<ArrowRightLeft size={22} className="text-blue-500" />} 
                  label="تغيير العملة" 
                  subLabel={CURRENCY_NAMES[currency]}
                  onClick={() => setShowCurrencyModal(true)} 
                />
                
                <SettingsButton 
                  icon={<Crown size={22} className="text-amber-500" />} 
                  label="خطط الاشتراك" 
                  subLabel={tier === SubscriptionTier.PREMIUM ? "بريميوم مفعل" : tier === SubscriptionTier.GOLD ? "جولد مفعل" : tier === SubscriptionTier.BASIC ? "بيسك مفعل" : "اشترك الآن للتطوير"}
                  onClick={() => setShowProModal(true)} 
                />

                <SettingsButton 
                  icon={<HeadphonesIcon size={22} className="text-purple-500" />} 
                  label="الدعم الفني" 
                  subLabel="تواصل معنا عبر واتساب"
                  href={getWhatsAppUrl("أحتاج لمساعدة في تطبيق ربحي")}
                />
              </div>

              <div className="bg-gradient-to-br from-emerald-900 to-emerald-950 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden mt-8 border border-white/10">
                <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-400/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                <div className="relative">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-white/10 backdrop-blur-xl rounded-3xl flex items-center justify-center border border-white/20">
                      <Calculator size={36} className="text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black mb-1">تطبيق ربحي</h3>
                      <p className="text-[10px] text-emerald-300 font-bold uppercase tracking-[0.2em]">الإصدار 1.0.0</p>
                    </div>
                  </div>
                  <p className="text-sm text-emerald-100/70 leading-relaxed mb-6 font-medium">
                    برمجة وتطوير <span className="text-white font-black underline underline-offset-4 decoration-amber-500">{WHATSAPP_CONTACT_NAME}</span>. نهدف لتوفير أفضل الأدوات المالية لأصحاب المحلات في العراق.
                  </p>
                  <div className="flex gap-4">
                    <button 
                      onClick={handleShare}
                      className="flex-1 bg-white/10 border border-white/20 py-3 rounded-2xl text-xs font-black uppercase tracking-wider backdrop-blur-md active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <Share2 size={16} />
                      مشاركة
                    </button>
                    <button 
                      onClick={() => setShowRateModal(true)}
                      className="flex-1 bg-emerald-500 py-3 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <Star size={16} className="fill-slate-900" />
                      تقييم
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-6 left-6 right-6 bg-[#0d1f18]/90 backdrop-blur-xl rounded-[2.5rem] py-4 px-8 flex justify-around items-center z-20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-emerald-500/20">
        <NavButton active={screen === 'dashboard'} onClick={() => setScreen('dashboard')} icon={<Home size={24} />} label="الرئيسية" />
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowAddMenu(true)}
          className="bg-emerald-500 text-slate-900 w-20 h-20 rounded-[2.5rem] flex items-center justify-center -mt-16 shadow-[0_0_30px_rgba(16,185,129,0.4)] relative active:scale-95 transition-all group border-4 border-[#0a1510]"
        >
          <div className="absolute inset-0 bg-emerald-400 rounded-[2.5rem] blur-xl opacity-0 group-hover:opacity-40 transition-opacity"></div>
          <Plus size={36} className="relative z-10 font-black" />
        </motion.button>
        <NavButton active={screen === 'settings'} onClick={() => setScreen('settings')} icon={<Settings size={24} />} label="المزيد" />
      </nav>

      {/* Add Item Menu Modal */}
      <Modal isOpen={showAddMenu} onClose={() => setShowAddMenu(false)}>
        <div className="text-center">
          <h3 className="text-2xl font-black mb-6 text-emerald-50">ماذا تريد أن تضيف؟</h3>
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => {
                setAddingType(ItemType.PRODUCT);
                setShowAddMenu(false);
                setScreen('add');
              }}
              className="bg-[#122b22] p-8 rounded-[2.5rem] border border-emerald-500/20 flex flex-col items-center gap-4 hover:bg-emerald-500/10 active:scale-95 transition-all"
            >
              <div className="bg-emerald-500/20 p-4 rounded-3xl">
                <Package size={32} className="text-emerald-400" />
              </div>
              <span className="font-black text-emerald-100">إضافة منتج</span>
            </button>
            <button 
              onClick={() => {
                setAddingType(ItemType.BOX);
                setShowAddMenu(false);
                setScreen('add');
              }}
              className="bg-[#122b22] p-8 rounded-[2.5rem] border border-emerald-500/20 flex flex-col items-center gap-4 hover:bg-emerald-500/10 active:scale-95 transition-all"
            >
              <div className="bg-emerald-400 p-4 rounded-3xl">
                <Database size={32} className="text-slate-900" />
              </div>
              <span className="font-black text-emerald-100">إضافة صندوق</span>
            </button>
          </div>
        </div>
      </Modal>

      <RateModal isOpen={showRateModal} onClose={() => setShowRateModal(false)} />

      {/* Subscription Modal */}
      <Modal isOpen={showProModal} onClose={() => setShowProModal(false)}>
        <div className="relative mb-6">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowProModal(false)}
            className="absolute right-0 top-0 bg-emerald-500/10 p-2.5 rounded-xl backdrop-blur-md ring-1 ring-emerald-500/30 hover:bg-emerald-500/20 transition-all group flex items-center gap-2"
          >
            <ArrowRight className="text-emerald-400 group-hover:-translate-x-1 transition-transform" size={18} />
            <span className="text-[10px] font-black uppercase text-emerald-400">رجوع</span>
          </motion.button>
        </div>

        <div className="text-center px-1">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-[2rem] flex items-center justify-center text-white mx-auto mb-4 shadow-xl rotate-12">
            <Crown size={40} className="fill-white" />
          </div>
          <h3 className="text-2xl font-black mb-1 text-amber-400">خطط تطبيق ربحي</h3>
          <p className="text-xs text-emerald-100/50 mb-6">اختر الخطة المناسبة لحجم تجارتك</p>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1 pb-4">
            {activatingTier ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#122b22] p-6 rounded-[2.5rem] border border-emerald-500/20 text-center"
              >
                <h4 className="text-emerald-400 font-black mb-4">تفعيل خطة {activatingTier === SubscriptionTier.PREMIUM ? 'بريميوم' : activatingTier === SubscriptionTier.GOLD ? 'جولد' : 'بيسك'}</h4>
                <input 
                  type="password"
                  placeholder="أدخل كود التفعيل"
                  value={activationInput}
                  onChange={(e) => setActivationInput(e.target.value)}
                  className="w-full bg-[#0a1510] border-2 border-emerald-900 shadow-inner rounded-2xl p-4 text-center text-2xl font-black mb-4 tracking-widest text-white outline-none focus:border-emerald-500"
                />
                <div className="flex gap-3">
                  <button 
                    onClick={() => handleUnlockPro(activatingTier, activationInput)}
                    className="flex-1 bg-emerald-500 text-slate-900 font-black py-4 rounded-2xl shadow-lg"
                  >تأكيد</button>
                  <button 
                    onClick={() => {
                      setActivatingTier(null);
                      setActivationInput('');
                    }}
                    className="flex-1 bg-white/5 text-emerald-100/50 font-black py-4 rounded-2xl"
                  >إلغاء</button>
                </div>
              </motion.div>
            ) : (
              <>
                {/* Premium */}
                <div className={`p-5 rounded-[2rem] border-2 text-right transition-all ${tier === SubscriptionTier.PREMIUM ? 'bg-amber-500/10 border-amber-500 shadow-lg' : 'bg-[#0a1510] border-emerald-900/20'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="bg-amber-500 text-slate-900 px-3 py-1 rounded-full text-[10px] font-black">بريميوم (كامل)</span>
                    <span className="text-lg font-black">25,000 د.ع</span>
                  </div>
                  <ul className="text-[11px] space-y-2 text-emerald-100/60 font-bold">
                    <li>• عدد غير محدود من المنتجات</li>
                    <li>• تقارير ربحية تفصيلية</li>
                    <li>• أولوية في الدعم الفني</li>
                  </ul>
                  {tier !== SubscriptionTier.PREMIUM && (
                    <button 
                      onClick={() => setActivatingTier(SubscriptionTier.PREMIUM)}
                      className="w-full mt-4 bg-amber-500 text-slate-900 py-3 rounded-2xl text-xs font-black shadow-xl"
                    >تفعيل بريميوم</button>
                  )}
                </div>

                {/* Basic */}
                <div className={`p-5 rounded-[2rem] border-2 text-right transition-all ${tier === SubscriptionTier.BASIC ? 'bg-blue-500/10 border-blue-500 shadow-lg' : 'bg-[#0a1510] border-emerald-900/20'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-[10px] font-black">بيسك (الأكثر طلباً)</span>
                    <span className="text-lg font-black">15,000 د.ع</span>
                  </div>
                  <ul className="text-[11px] space-y-2 text-emerald-100/60 font-bold">
                    <li>• حد أقصى 20 منتج</li>
                    <li>• إحصائيات متقدمة</li>
                    <li>• دعم فني عبر الواتساب</li>
                  </ul>
                  {tier !== SubscriptionTier.BASIC && tier !== SubscriptionTier.GOLD && tier !== SubscriptionTier.PREMIUM && (
                    <button 
                      onClick={() => setActivatingTier(SubscriptionTier.BASIC)}
                      className="w-full mt-4 bg-blue-500 text-white py-3 rounded-2xl text-xs font-black shadow-xl"
                    >تفعيل بيسك</button>
                  )}
                </div>

                {/* Gold */}
                <div className={`p-5 rounded-[2rem] border-2 text-right transition-all ${tier === SubscriptionTier.GOLD ? 'bg-yellow-500/10 border-yellow-500 shadow-lg' : 'bg-[#0a1510] border-emerald-900/20'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="bg-yellow-500 text-slate-900 px-3 py-1 rounded-full text-[10px] font-black">جولد (متوسط)</span>
                    <span className="text-lg font-black">20,000 د.ع</span>
                  </div>
                  <ul className="text-[11px] space-y-2 text-emerald-100/60 font-bold">
                    <li>• حد أقصى 100 منتج</li>
                    <li>• إحصائيات تقويمية</li>
                    <li>• دعم سريع</li>
                  </ul>
                  {tier !== SubscriptionTier.GOLD && tier !== SubscriptionTier.PREMIUM && (
                    <button 
                      onClick={() => setActivatingTier(SubscriptionTier.GOLD)}
                      className="w-full mt-4 bg-yellow-500 text-slate-900 py-3 rounded-2xl text-xs font-black shadow-xl"
                    >تفعيل جولد</button>
                  )}
                </div>

                {/* Free */}
                <div className={`p-5 rounded-[2rem] border-2 text-right transition-all ${tier === SubscriptionTier.FREE ? 'bg-emerald-500/10 border-emerald-500 shadow-lg' : 'bg-[#0a1510] border-emerald-900/20'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="bg-emerald-500 text-slate-900 px-3 py-1 rounded-full text-[10px] font-black">مجاني</span>
                    <span className="text-lg font-black">0 د.ع</span>
                  </div>
                  <ul className="text-[11px] space-y-2 text-emerald-100/60 font-bold">
                    <li>• حد أقصى 3 منتجات</li>
                    <li>• متابعة أرباح أساسية</li>
                    <li>• دعم العملات المتعددة</li>
                  </ul>
                </div>
              </>
            )}
          </div>
          
          <div className="mt-4 p-4 bg-[#122b22]/50 rounded-2xl border border-emerald-900/30">
            <p className="text-[10px] text-emerald-500/50 mb-2 font-black">للحصول على كود التفعيل تواصل معنا</p>
            <a 
              href={getWhatsAppUrl("مرحباً، أريد شراء كود تفعيل لتطبيق ربحي")}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 text-white font-black text-sm bg-emerald-500/10 py-3 rounded-xl border border-emerald-500/20"
            >
              <MessageSquare size={16} className="fill-emerald-500 text-white" />
              <span>{WHATSAPP_CONTACT_NAME}</span>
            </a>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)}>
        <div className="text-center py-4">
          <div className="w-20 h-20 bg-red-500/10 rounded-[2.5rem] flex items-center justify-center text-red-500 mx-auto mb-6 border border-red-500/20 shadow-xl">
            <X size={40} />
          </div>
          <h3 className="text-2xl font-black mb-2 text-white">تأكيد الحذف</h3>
          <p className="text-sm text-emerald-100/60 font-bold mb-8">
            هل أنت متأكد من حذف هذا المنتج؟ لا يمكن التراجع عن هذا الإجراء وسيتم مسح البيانات نهائياً.
          </p>
          
          <div className="flex gap-4">
            <button 
              onClick={() => confirmDeleteId && deleteProduct(confirmDeleteId)}
              className="flex-1 bg-red-500 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-red-600 transition-colors active:scale-95"
            >
              نعم، حذف
            </button>
            <button 
              onClick={() => setConfirmDeleteId(null)}
              className="flex-1 bg-white/5 text-emerald-100 font-black py-4 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors active:scale-95"
            >
              لا، تراجع
            </button>
          </div>
        </div>
      </Modal>

      {/* Currency Modal */}
      <Modal isOpen={showCurrencyModal} onClose={() => setShowCurrencyModal(false)}>
        <div className="relative mb-6">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCurrencyModal(false)}
            className="absolute right-0 top-0 bg-emerald-500/10 p-2.5 rounded-xl backdrop-blur-md ring-1 ring-emerald-500/30 hover:bg-emerald-500/20 transition-all group flex items-center gap-2"
          >
            <ArrowRight className="text-emerald-400 group-hover:-translate-x-1 transition-transform" size={18} />
            <span className="text-[10px] font-black uppercase text-emerald-400">رجوع</span>
          </motion.button>
        </div>

        <div className="flex items-center gap-3 mb-6 px-2">
           <div className="w-10 h-10 bg-emerald-500 text-slate-900 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
             <ArrowRightLeft size={20} />
           </div>
           <h3 className="text-xl font-black text-emerald-50">اختر العملة</h3>
        </div>
        <div className="grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto px-1">
          {Object.values(Currency).map((c) => (
            <button
              key={c}
              onClick={() => {
                handleCurrencyChange(c);
                setShowCurrencyModal(false);
              }}
              className={`flex items-center justify-between p-5 rounded-3xl border-2 transition-all ${
                currency === c 
                  ? 'bg-emerald-500/10 border-emerald-500 shadow-xl translate-y-[-2px]' 
                  : 'bg-[#0a1510] border-emerald-900/30 hover:border-emerald-500/40 shadow-sm'
              }`}
            >
              <div className="flex items-center gap-4 text-right">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black ${currency === c ? 'bg-emerald-500 text-slate-900' : 'bg-emerald-900/20 text-emerald-500'}`}>
                  {CURRENCY_SYMBOLS[c]}
                </div>
                <div>
                  <span className={`block font-black text-lg leading-none mb-1 ${currency === c ? 'text-white' : 'text-emerald-100/70'}`}>
                    {CURRENCY_NAMES[c]}
                  </span>
                  <span className="text-[10px] text-emerald-500/40 font-bold uppercase tracking-widest">{c}</span>
                </div>
              </div>
              {currency === c && (
                <div className="w-6 h-6 bg-emerald-500 text-slate-900 rounded-full flex items-center justify-center">
                  <Plus size={12} className="rotate-45" />
                </div>
              )}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function RateModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [stars, setStars] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="text-center py-4 rtl" dir="rtl">
        {!submitted ? (
          <>
            <div className="w-24 h-24 bg-amber-500/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 border border-amber-500/20 shadow-xl">
              <Star size={44} className="text-amber-500 fill-amber-500" />
            </div>
            <h3 className="text-2xl font-black mb-2 text-white">ما هو تقييمك للتطبيق؟</h3>
            <p className="text-emerald-500/60 text-[10px] font-black mb-8 uppercase tracking-[0.2em] leading-none">رأيك يهمنا لتطوير التطبيق</p>
            
            <div className="flex justify-center gap-3 mb-10">
              {[1, 2, 3, 4, 5].map((s) => (
                <motion.button 
                  key={s} 
                  whileHover={{ scale: 1.1, rotate: s % 2 === 0 ? 5 : -5 }}
                  whileTap={{ scale: 0.85 }}
                  onClick={() => setStars(s)}
                  className="transition-all"
                >
                  <Star 
                    size={40} 
                    className={`${s <= stars ? 'text-amber-500 fill-amber-500' : 'text-emerald-900/40'} transition-all duration-300 drop-shadow-[0_0_15_rgba(245,158,11,0.2)]`} 
                  />
                </motion.button>
              ))}
            </div>

            <button 
              onClick={() => {
                if (stars > 0) setSubmitted(true);
              }}
              disabled={stars === 0}
              className="w-full bg-emerald-500 text-slate-900 font-black py-6 rounded-[2rem] shadow-2xl shadow-emerald-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 text-lg"
            >
              إرسال التقييم
            </button>
          </>
        ) : (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="py-10"
          >
            <div className="w-24 h-24 bg-emerald-500/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 border border-amber-500/20">
              <TrendingUp size={48} className="text-emerald-500" />
            </div>
            <h3 className="text-3xl font-black mb-4 text-white">شكراً لك!</h3>
            <p className="text-emerald-100/60 font-black text-sm mb-10 leading-relaxed">
              نشكرك على تقييمك بـ <span className="text-amber-500">{stars} نجوم</span>. 
              <br />
              هذا يساعدنا على تحسين تطبيق ربحي باستمرار.
            </p>
            <button 
              onClick={onClose}
              className="w-full bg-slate-900 text-white font-black py-5 rounded-[2rem] border border-emerald-900/30 active:scale-95 transition-all text-md"
            >
              إغلاق
            </button>
          </motion.div>
        )}
      </div>
    </Modal>
  );
}

function ProfitTicker({ products, formatCurrency }: { products: Product[], formatCurrency: (v: number) => string }) {
  if (products.length === 0) return null;

  const calculateProfitPer = (p: Product) => {
    return p.itemType === ItemType.BOX 
      ? (p.sellingPrice - (p.purchasePrice / p.quantity))
      : (p.sellingPrice - p.purchasePrice - p.expenses);
  };

  const productEntries = products.map((p) => {
    const currentProfitPer = calculateProfitPer(p);
    const previousVersions = products.filter(prev => prev.name === p.name && prev.createdAt < p.createdAt);
    previousVersions.sort((a, b) => b.createdAt - a.createdAt);

    let trend: 'up' | 'down' | 'neutral' = 'neutral';
    if (previousVersions.length > 0) {
      const prevProfitPer = calculateProfitPer(previousVersions[0]);
      if (currentProfitPer > prevProfitPer + 0.01) trend = 'up';
      else if (currentProfitPer < prevProfitPer - 0.01) trend = 'down';
    }

    return { name: p.name, profit: currentProfitPer * p.quantity, trend };
  });

  const uniqueItemsMap = new Map();
  productEntries.forEach(item => {
    if (!uniqueItemsMap.has(item.name)) {
      uniqueItemsMap.set(item.name, item);
    }
  });

  const tickerItems = Array.from(uniqueItemsMap.values());
  const displayItems = [...tickerItems, ...tickerItems, ...tickerItems];

  return (
    <div className="relative overflow-hidden w-full py-2 -mx-4 px-4 bg-emerald-500/5 border-y border-emerald-500/10 mb-4 font-sans mask-fade-edges">
      <div className="flex">
        <motion.div 
          animate={{ x: ["0%", "-33.33%"] }}
          transition={{ 
            ease: "linear", 
            duration: Math.max(12, tickerItems.length * 4), 
            repeat: Infinity 
          }}
          className="flex whitespace-nowrap gap-10 items-center"
        >
          {displayItems.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <span className="text-[11px] font-black text-emerald-300 uppercase tracking-tight">أرباح {item.name}</span>
              <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
                <span className="text-[11px] font-black text-white">{formatCurrency(item.profit)}</span>
                {item.trend === 'up' && <TrendingUp size={10} className="text-emerald-400 stroke-[3px]" />}
                {item.trend === 'down' && <TrendingDown size={10} className="text-red-400 stroke-[3px]" />}
                {item.trend === 'neutral' && <Minus size={10} className="text-slate-500/40" />}
              </div>
              <span className="text-emerald-500/20 px-2">•</span>
            </div>
          ))}
        </motion.div>
      </div>
      <style>{`
        .mask-fade-edges {
          mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
        }
      `}</style>
    </div>
  );
}

function SummaryCard({ icon, label, value, onClick, primary }: { icon: any, label: string, value: string, onClick?: () => void, primary?: boolean }) {
  return (
    <button 
      onClick={onClick}
      disabled={!onClick}
      className={`${primary ? 'bg-emerald-500' : 'bg-gradient-to-br from-[#122b22] to-[#0a1510]'} p-6 rounded-[2rem] shadow-2xl border ${primary ? 'border-white/20' : 'border-emerald-500/20'} flex flex-col justify-between h-36 group hover:border-emerald-500/40 transition-all relative overflow-hidden text-right w-full disabled:cursor-default`}
    >
      <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500"></div>
      <span className={`relative z-10 ${primary ? 'text-white' : 'text-emerald-400'} text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 leading-none mb-4`}>
        {icon}
        {label}
      </span>
      <span className={`relative z-10 text-2xl font-black ${primary ? 'text-white' : 'text-emerald-50'} tracking-tight leading-none overflow-hidden text-ellipsis truncate`}>{value}</span>
    </button>
  );
}

function ProductForm({ onAdd, onUpdate, onDelete, editingProduct, cancelEdit, currency, formatCurrency, initialType }: { 
  onAdd: (p: Omit<Product, 'id' | 'createdAt'>) => void;
  onUpdate: (id: string, p: Omit<Product, 'id' | 'createdAt'>) => void;
  onDelete?: (id: string) => void;
  editingProduct: Product | null;
  cancelEdit: () => void;
  currency: Currency;
  formatCurrency: (val: number) => string;
  initialType: ItemType;
}) {
  const [form, setForm] = useState({
    name: editingProduct?.name || '',
    purchasePrice: editingProduct?.purchasePrice || 0,
    sellingPrice: editingProduct?.sellingPrice || 0,
    quantity: editingProduct?.quantity || 1,
    expenses: editingProduct?.expenses || 0,
    itemType: editingProduct?.itemType || initialType
  });

  const isBox = form.itemType === ItemType.BOX;

  const piecePrice = isBox ? (form.quantity > 0 ? form.purchasePrice / form.quantity : 0) : form.purchasePrice;
  const profitPerItem = form.sellingPrice - piecePrice - (isBox ? 0 : form.expenses);
  const totalProfit = profitPerItem * form.quantity - (isBox ? form.expenses : 0);

  const handleSubmit = () => {
    if (editingProduct) {
      onUpdate(editingProduct.id, form);
    } else {
      onAdd(form);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-500 text-white rounded-[1.25rem] flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.4)]">
            <Plus size={24} className={editingProduct ? "rotate-45" : ""} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-emerald-100 leading-none mb-1">
              {editingProduct ? (isBox ? 'تعديل الصندوق' : 'تعديل المنتج') : (isBox ? 'إضافة صندوق' : 'إضافة منتج')}
            </h2>
            <p className="text-[10px] text-emerald-500/60 font-bold uppercase tracking-widest">
              {isBox ? 'أدخل تفاصيل الصندوق بدقة' : 'أدخل تفاصيل المنتج بدقة'}
            </p>
          </div>
        </div>
        {editingProduct && (
          <div className="flex gap-2">
            <button 
              onClick={() => onDelete?.(editingProduct.id)}
              className="text-[10px] font-black uppercase tracking-widest text-red-500 bg-red-500/10 px-4 py-2 rounded-xl border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"
            >
              حذف
            </button>
            <button 
              onClick={cancelEdit}
              className="text-[10px] font-black uppercase tracking-widest text-emerald-100/50 bg-white/5 px-4 py-2 rounded-xl"
            >
              إلغاء 
            </button>
          </div>
        )}
      </div>

      <div className="bg-[#122b22]/40 p-8 rounded-[2.5rem] shadow-2xl border border-emerald-900/30 space-y-6">
        <InputField 
          label={isBox ? "اسم الصندوق" : "اسم المنتج"} 
          type="text" 
          value={form.name} 
          onChange={(v) => setForm({ ...form, name: v })} 
          placeholder={isBox ? "مثال: صندوق آيفون 15" : "مثال: آيفون 15 برو"} 
        />
        
        {isBox ? (
          <>
            <div className="grid grid-cols-2 gap-5">
               <InputField 
                 label="سعر الصندوق (IQD)" 
                 type="number" 
                 value={form.purchasePrice} 
                 onChange={(v) => setForm({ ...form, purchasePrice: Number(v) })} 
                 placeholder="0" 
               />
               <InputField 
                 label="عدد قطع الصندوق" 
                 type="number" 
                 value={form.quantity} 
                 onChange={(v) => setForm({ ...form, quantity: Math.max(1, Number(v)) })} 
                 placeholder="1" 
               />
            </div>
            <div className="grid grid-cols-2 gap-5">
               <InputField 
                 label="سعر القطعة (يُحسب)" 
                 type="text" 
                 value={formatCurrency(piecePrice).replace(' IQD', '').replace(' $', '')} 
                 onChange={() => {}} 
                 readOnly
                 placeholder="0" 
               />
               <InputField 
                 label="سعر بيع القطعة (IQD)" 
                 type="number" 
                 value={form.sellingPrice} 
                 onChange={(v) => setForm({ ...form, sellingPrice: Number(v) })} 
                 placeholder="0" 
               />
            </div>
            <InputField label="المصاريف" type="number" value={form.expenses} onChange={(v) => setForm({ ...form, expenses: Number(v) })} placeholder="0" />
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-5">
               <InputField 
                 label="سعر الشراء (IQD)" 
                 type="number" 
                 value={form.purchasePrice} 
                 onChange={(v) => setForm({ ...form, purchasePrice: Number(v) })} 
                 placeholder="0" 
               />
               <InputField 
                 label="سعر البيع (IQD)" 
                 type="number" 
                 value={form.sellingPrice} 
                 onChange={(v) => setForm({ ...form, sellingPrice: Number(v) })} 
                 placeholder="0" 
               />
            </div>
            <div className="grid grid-cols-2 gap-5">
               <InputField 
                 label="الكمية" 
                 type="number" 
                 value={form.quantity} 
                 onChange={(v) => setForm({ ...form, quantity: Math.max(1, Number(v)) })} 
                 placeholder="1" 
               />
               <InputField label="المصاريف" type="number" value={form.expenses} onChange={(v) => setForm({ ...form, expenses: Number(v) })} placeholder="0" />
            </div>
          </>
        )}
      </div>

      {/* Real-time Calculation Result */}
      <motion.div 
        layout
        className="bg-emerald-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden space-y-4"
      >
        <div className="absolute top-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mt-12 blur-2xl"></div>
        
        <div className="flex divide-x divide-x-reverse divide-white/10 relative z-10">
          <div className="flex-1 text-center pr-2">
            <span className="text-[10px] text-emerald-400 font-black uppercase tracking-[0.2em] block mb-2 leading-none">
              {isBox ? 'سعر القطعة' : 'ربح القطعة'}
            </span>
            <span className={`text-xl font-black drop-shadow-md text-white`}>
              {formatCurrency(isBox ? piecePrice : profitPerItem)}
            </span>
          </div>
          <div className="flex-1 text-center pl-2">
            <span className="text-[10px] text-amber-400 font-black uppercase tracking-[0.2em] block mb-2 leading-none">
              {isBox ? 'الربح للقطعة' : 'الربح الكلي'}
            </span>
            <span className={`text-xl font-black drop-shadow-md text-amber-400`}>
              {formatCurrency(isBox ? profitPerItem : totalProfit)}
            </span>
          </div>
        </div>

        {isBox && (
          <div className="pt-4 border-t border-white/10 text-center relative z-10">
            <span className="text-[10px] text-emerald-300 font-black uppercase tracking-[0.2em] block mb-1 leading-none">الربح الكلي للصندوق</span>
            <span className="text-3xl font-black text-white">{formatCurrency(totalProfit)}</span>
          </div>
        )}
      </motion.div>

      <button
        disabled={!form.name || form.purchasePrice <= 0 || form.sellingPrice <= 0}
        onClick={handleSubmit}
        className="w-full bg-slate-900 text-white font-black py-6 rounded-[2rem] shadow-2xl shadow-slate-900/20 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 active:scale-95 transition-all text-lg border border-emerald-900/30"
      >
        {editingProduct ? 'حفظ التغييرات' : (isBox ? 'حفظ الصندوق' : 'حفظ المنتج')}
      </button>
    </div>
  );
}

function InputField({ label, type, value, onChange, placeholder, readOnly }: { label: string, type: string, value: any, onChange: (v: any) => void, placeholder?: string, readOnly?: boolean }) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-black text-emerald-500/50 mr-2 uppercase tracking-widest block leading-none">{label}</label>
      <input
        type={type}
        readOnly={readOnly}
        value={value === 0 && type === 'number' ? '' : value}
        onChange={(e) => !readOnly && onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-[#0a1510] border border-emerald-900/50 rounded-2xl p-4 focus:border-emerald-500 focus:bg-[#0d1f18] focus:outline-none transition-all font-bold text-white placeholder:text-emerald-900 shadow-inner ${readOnly ? 'opacity-60 cursor-not-allowed bg-emerald-900/10' : ''}`}
      />
    </div>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean, icon: any, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${active ? 'text-emerald-400' : 'text-emerald-900 group-hover:text-emerald-600'}`}
    >
      <div className={`p-2 rounded-xl transition-all ${active ? 'bg-emerald-500/10' : 'group-hover:bg-emerald-500/5'}`}>
        {icon}
      </div>
      <span className={`text-[10px] font-black uppercase tracking-widest ${active ? 'opacity-100' : 'opacity-30'}`}>{label}</span>
      <AnimatePresence>
        {active && (
          <motion.span 
            layoutId="nav-indicator"
            className="w-5 h-1 bg-emerald-500 rounded-full mt-1 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
          />
        )}
      </AnimatePresence>
    </button>
  );
}

function SettingsButton({ icon, label, subLabel, onClick, href }: { icon: any, label: string, subLabel?: string, onClick?: () => void, href?: string }) {
  const content = (
    <>
      <div className="flex items-center gap-5 text-right">
        <div className="w-14 h-14 rounded-2xl bg-[#0a1510] border border-emerald-900/50 flex items-center justify-center transition-all group-hover:bg-emerald-500 group-hover:text-white shadow-inner">
          {icon}
        </div>
        <div>
          <span className="block font-black text-white text-lg leading-tight mb-1">{label}</span>
          {subLabel && <span className="text-[10px] text-emerald-500/50 font-bold uppercase tracking-[0.15em] leading-none">{subLabel}</span>}
        </div>
      </div>
      <div className="w-10 h-10 rounded-full bg-[#0a1510] flex items-center justify-center text-emerald-900 group-hover:bg-emerald-500/20 group-hover:text-emerald-400 group-hover:translate-x-[-4px] transition-all border border-emerald-900/30">
        <ChevronLeft size={20} />
      </div>
    </>
  );

  const className = "w-full bg-[#122b22]/30 p-6 rounded-3xl shadow-xl border border-emerald-900/20 flex items-center justify-between group active:scale-[0.98] transition-transform hover:border-emerald-500/40 hover:bg-[#122b22]/50";

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {content}
      </a>
    );
  }

  return (
    <button onClick={onClick} className={className}>
      {content}
    </button>
  );
}

function Modal({ isOpen, onClose, children }: { isOpen: boolean, onClose: () => void, children: ReactNode }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100]" 
          />
          <motion.div 
            initial={{ opacity: 0, y: 300, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 400, scale: 0.9, transition: { duration: 0.2 } }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.y > 150) {
                onClose();
              }
            }}
            className="fixed bottom-0 left-0 right-0 bg-[#0d1f18] rounded-t-[3.5rem] p-10 z-[101] shadow-[0_-20px_60px_rgba(0,0,0,0.5)] max-w-lg mx-auto border-t border-emerald-500/20 touch-none"
          >
            <div className="w-16 h-1.5 bg-white/10 rounded-full mx-auto mb-10"></div>
            <div className="text-white">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
