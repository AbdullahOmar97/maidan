"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ShoppingBag,
  ShoppingCart,
  Plus,
  Loader2,
  Trash2,
  Check,
  X,
  ChevronRight,
  Inbox,
  Clock,
  CheckCircle,
  Phone,
  User,
  Mail,
  FileText,
} from "lucide-react";

interface ProductOption {
  id: number;
  name: string;
  value: string;
  additional_price: string;
  stock: number;
}

interface Product {
  id: number;
  name: string;
  description: string;
  price: string;
  currency: string;
  image: string | null;
  is_active: boolean;
  options: ProductOption[];
}

interface CartItem {
  id: string; // unique cart item id (product.id + "-" + option.id)
  product: Product;
  selectedOption: ProductOption | null;
  quantity: number;
}

export default function PublicStorePage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedOption, setSelectedOption] = useState<ProductOption | null>(null);
  
  // Checkout Form State
  const [checkoutForm, setCheckoutForm] = useState({
    buyer_name: "",
    buyer_phone: "",
    buyer_email: "",
    notes: "",
  });

  // Success Order State
  const [placedOrder, setPlacedOrder] = useState<any | null>(null);

  // Queries
  const { data: academy, isLoading: academyLoading } = useQuery({
    queryKey: ["academy", "public-info"],
    queryFn: async () => {
      const res = await api.tenants.publicInfo();
      return res.data;
    },
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["store", "products", "public"],
    queryFn: async () => {
      const res = await api.store.products.listPublic();
      return Array.isArray(res.data) ? res.data : (res.data as any).results || [];
    },
  });

  // Dynamic branding updates
  useEffect(() => {
    if (academy?.name) {
      document.title = `${academy.name} | المتجر الإلكتروني`;
    }
    if (academy?.favicon) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = academy.favicon;
    }
  }, [academy]);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem("maidan_public_cart");
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        // ignore
      }
    }
  }, []);

  // Save cart to localStorage on changes
  const saveCart = (newCart: CartItem[]) => {
    setCart(newCart);
    localStorage.setItem("maidan_public_cart", JSON.stringify(newCart));
  };

  // Cart operations
  const addToCart = (product: Product, option: ProductOption | null, quantity = 1) => {
    const cartItemId = `${product.id}-${option?.id ?? "none"}`;
    const existingIndex = cart.findIndex((item) => item.id === cartItemId);

    // Validate stock
    if (option && option.stock < quantity) {
      toast.error(`المخزون غير كافٍ لهذا الخيار. المتاح: ${option.stock}`);
      return;
    }

    if (existingIndex > -1) {
      const newCart = [...cart];
      const newQty = newCart[existingIndex].quantity + quantity;
      if (option && option.stock < newQty) {
        toast.error(`لا يمكن إضافة المزيد، تم الوصول للحد الأقصى للمخزون. المتاح: ${option.stock}`);
        return;
      }
      newCart[existingIndex].quantity = newQty;
      saveCart(newCart);
    } else {
      saveCart([...cart, { id: cartItemId, product, selectedOption: option, quantity }]);
    }
    
    toast.success(`تم إضافة ${product.name} إلى السلة.`);
    setSelectedProduct(null);
    setSelectedOption(null);
  };

  const updateQuantity = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(itemId);
      return;
    }
    
    const newCart = cart.map((item) => {
      if (item.id === itemId) {
        if (item.selectedOption && item.selectedOption.stock < newQty) {
          toast.error(`المخزون غير كافٍ. المتاح: ${item.selectedOption.stock}`);
          return item;
        }
        return { ...item, quantity: newQty };
      }
      return item;
    });
    saveCart(newCart);
  };

  const removeFromCart = (itemId: string) => {
    const newCart = cart.filter((item) => item.id !== itemId);
    saveCart(newCart);
    toast.success("تم إزالة المنتج من السلة.");
  };

  const clearCart = () => {
    saveCart([]);
    localStorage.removeItem("maidan_public_cart");
  };

  // Calculations
  const getCartTotal = () => {
    return cart.reduce((total, item) => {
      const basePrice = parseFloat(item.product.price);
      const extraPrice = item.selectedOption ? parseFloat(item.selectedOption.additional_price) : 0;
      return total + (basePrice + extraPrice) * item.quantity;
    }, 0);
  };

  // Order Placement Mutation
  const checkoutMutation = useMutation({
    mutationFn: (orderData: any) => api.store.orders.createPublic(orderData),
    onSuccess: (res) => {
      setPlacedOrder(res.data);
      clearCart();
      setIsCheckoutOpen(false);
      setIsCartOpen(false);
      toast.success("تم إرسال طلبك بنجاح!");
    },
    onError: (error: any) => {
      const errMsg = error.response?.data?.detail || "حدث خطأ أثناء إتمام الطلب. يرجى المحاولة لاحقاً.";
      toast.error(errMsg);
    },
  });

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutForm.buyer_name || !checkoutForm.buyer_phone) {
      toast.error("يرجى ملء الاسم ورقم الهاتف لإتمام الطلب.");
      return;
    }

    const orderData = {
      buyer_name: checkoutForm.buyer_name,
      buyer_phone: checkoutForm.buyer_phone,
      buyer_email: checkoutForm.buyer_email || undefined,
      notes: checkoutForm.notes,
      items: cart.map((item) => ({
        product: item.product.id,
        option: item.selectedOption?.id ?? null,
        quantity: item.quantity,
      })),
    };

    checkoutMutation.mutate(orderData);
  };

  if (academyLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-bold">جاري تحميل المتجر الإلكتروني...</p>
      </div>
    );
  }

  const currency = "JOD"; // standard for Maidan

  if (placedOrder) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <div className="glass-card max-w-xl w-full p-8 text-center border border-emerald-500/20 relative overflow-hidden">
          <div className="absolute top-0 end-0 w-64 h-64 bg-emerald-500/5 blur-[80px] -me-32 -mt-32 pointer-events-none" />
          
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6 text-emerald-400">
            <CheckCircle className="w-12 h-12" />
          </div>

          <h1 className="text-2xl font-black mb-2 text-white">تم إرسال طلبك بنجاح!</h1>
          <p className="text-emerald-400 font-bold mb-6">رقم الطلب الخاص بك: #{placedOrder.id}</p>

          <div className="bg-white/5 border border-white/5 rounded-2xl p-6 mb-6 space-y-3 text-start text-sm">
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-muted-foreground font-bold">الاسم:</span>
              <span className="font-bold text-white">{placedOrder.buyer_name}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-muted-foreground font-bold">رقم الهاتف:</span>
              <span className="font-bold text-white">{placedOrder.buyer_phone}</span>
            </div>
            <div className="flex justify-between pb-1">
              <span className="text-muted-foreground font-bold">المجموع الإجمالي:</span>
              <span className="font-black text-primary">{formatCurrency(placedOrder.total_amount, currency)}</span>
            </div>
          </div>

          <div className="text-xs text-muted-foreground leading-relaxed mb-8 bg-primary/5 border border-primary/10 p-4 rounded-xl text-start flex gap-3">
            <Clock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-white mb-1">تعليمات الاستلام والدفع:</p>
              <p>تم حجز المنتجات مؤقتاً في مخزون الأكاديمية. يرجى التوجه إلى مقر الأكاديمية لتأكيد الطلب والدفع نقداً واستلام طلبك.</p>
            </div>
          </div>

          <button
            onClick={() => setPlacedOrder(null)}
            className="w-full py-4 rounded-2xl gradient-brand text-white font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:opacity-95 active:scale-95 transition-all"
          >
            تصفح المتجر مجدداً
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary selection:text-white">
      {/* Dynamic glow effect background */}
      <div className="absolute top-0 end-0 w-[40%] h-[40%] bg-primary/10 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 start-0 w-[30%] h-[30%] bg-blue-500/5 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-black/40 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {academy?.logo ? (
            <img src={academy.logo} alt={academy.name} className="h-10 w-auto object-contain rounded" />
          ) : (
            <div className="w-10 h-10 rounded-lg gradient-brand flex items-center justify-center font-black text-white text-lg">
              {academy?.name?.[0]?.toUpperCase() ?? "M"}
            </div>
          )}
          <div>
            <h1 className="text-lg font-black leading-none">{academy?.name}</h1>
            <p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase tracking-widest">المتجر الإلكتروني</p>
          </div>
        </div>

        {/* Shopping Cart Trigger */}
        <button
          onClick={() => setIsCartOpen(true)}
          className="relative w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:text-white transition-all group active:scale-95"
        >
          <ShoppingCart className="w-5 h-5 text-muted-foreground group-hover:text-white transition-colors" />
          {cart.length > 0 && (
            <span className="absolute -top-1.5 -end-1.5 min-w-5 h-5 px-1 bg-primary text-white rounded-full flex items-center justify-center text-[10px] font-black glow-primary">
              {cart.reduce((t, i) => t + i.quantity, 0)}
            </span>
          )}
        </button>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12 relative z-10">
        <div className="mb-10 text-center max-w-xl mx-auto">
          <span className="text-primary font-black text-xs uppercase tracking-widest bg-primary/10 px-3 py-1.5 rounded-full">تصفح الكتالوج</span>
          <h2 className="text-3xl font-black tracking-tight text-white mt-4 mb-2">متجر الأجهزة والملابس الرياضية</h2>
          <p className="text-muted-foreground text-sm">اختر المنتجات الرياضية المعتمدة واحجزها مباشرة للاستلام من مقر الأكاديمية.</p>
        </div>

        {/* Product Catalog Grid */}
        {productsLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
            <p className="text-muted-foreground text-sm font-bold">جاري تحميل المنتجات...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-24 bg-white/[0.01] border border-white/5 rounded-3xl max-w-md mx-auto">
            <Inbox className="w-16 h-16 text-muted-foreground/45 mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-1">لا توجد منتجات معروضة حالياً</h3>
            <p className="text-muted-foreground text-xs">يرجى العودة لاحقاً لاستعراض المتجر.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {products
              .filter((p) => p.is_active)
              .map((product) => (
                <div
                  key={product.id}
                  className="group bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 hover:border-white/10 rounded-3xl p-6 transition-all flex flex-col justify-between relative overflow-hidden"
                >
                  <div>
                    {/* Image Area */}
                    <div className="aspect-video w-full rounded-2xl bg-white/5 border border-white/5 mb-5 flex items-center justify-center text-muted-foreground/50 overflow-hidden relative">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <ShoppingBag className="w-12 h-12 opacity-35" />
                      )}
                    </div>

                    <h3 className="text-lg font-black text-white mb-2 truncate">{product.name}</h3>
                    <p className="text-muted-foreground text-xs leading-relaxed line-clamp-3 mb-6 min-h-[4.5rem]">
                      {product.description || "لا يوجد وصف لهذا المنتج."}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-auto">
                    <div>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">السعر يبدأ من</p>
                      <p className="text-xl font-black text-primary mt-1">
                        {formatCurrency(product.price, currency)}
                      </p>
                    </div>

                    {product.options && product.options.length > 0 ? (
                      <button
                        onClick={() => {
                          setSelectedProduct(product);
                          setSelectedOption(product.options[0]);
                        }}
                        className="px-5 py-3 rounded-2xl bg-white/5 hover:bg-primary hover:text-white border border-white/10 hover:border-primary text-xs font-bold transition-all active:scale-95 flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        اختر الخيار
                      </button>
                    ) : (
                      <button
                        onClick={() => addToCart(product, null)}
                        className="px-5 py-3 rounded-2xl bg-primary text-white text-xs font-black hover:opacity-95 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-primary/10"
                      >
                        <Plus className="w-4 h-4" />
                        إضافة للسلة
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </main>

      {/* Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Overlay */}
          <div onClick={() => setIsCartOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Drawer Content */}
          <div className="relative w-full max-w-md h-full bg-neutral-950 border-s border-white/5 shadow-2xl p-6 flex flex-col justify-between z-10">
            <div>
              <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
                <div className="flex items-center gap-3">
                  <ShoppingCart className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-black">سلة المشتريات</h2>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center transition-all active:scale-95"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {cart.length === 0 ? (
                <div className="text-center py-20">
                  <ShoppingCart className="w-14 h-14 text-muted-foreground/35 mx-auto mb-4" />
                  <p className="text-muted-foreground text-sm font-bold">سلتك فارغة حالياً.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
                  {cart.map((item) => {
                    const price = parseFloat(item.product.price) + (item.selectedOption ? parseFloat(item.selectedOption.additional_price) : 0);
                    return (
                      <div
                        key={item.id}
                        className="flex gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 items-center justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm text-white truncate">{item.product.name}</p>
                          {item.selectedOption && (
                            <p className="text-[10px] text-primary font-bold mt-1">
                              المقاس/النوع: {item.selectedOption.value}
                            </p>
                          )}
                          <p className="text-xs font-bold text-muted-foreground mt-2">
                            {formatCurrency(price, currency)} × {item.quantity}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center bg-white/5 border border-white/5 rounded-xl">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="px-2.5 py-1 text-muted-foreground hover:text-white font-bold"
                            >
                              -
                            </button>
                            <span className="px-2 text-xs font-bold text-white">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="px-2.5 py-1 text-muted-foreground hover:text-white font-bold"
                            >
                              +
                            </button>
                          </div>

                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-white/5 pt-6 space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground font-bold">المجموع الإجمالي:</span>
                  <span className="text-xl font-black text-primary">{formatCurrency(getCartTotal(), currency)}</span>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={clearCart}
                    className="flex-1 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-xs hover:bg-white/10 transition-all active:scale-95"
                  >
                    تفريغ السلة
                  </button>
                  <button
                    onClick={() => setIsCheckoutOpen(true)}
                    className="flex-1 py-3.5 rounded-2xl bg-primary text-white font-black text-xs hover:opacity-95 transition-all active:scale-95 shadow-lg shadow-primary/15"
                  >
                    إتمام الطلب
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Dialog */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setIsCheckoutOpen(false)} className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

          <div className="relative glass-card max-w-md w-full p-6 border border-white/5 z-10">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
              <h2 className="text-lg font-black">إتمام عملية الحجز والطلب</h2>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground flex gap-1">
                  الاسم الكامل <span className="text-primary">*</span>
                </label>
                <div className="relative">
                  <User className="absolute start-3 top-3.5 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    required
                    value={checkoutForm.buyer_name}
                    onChange={(e) => setCheckoutForm({ ...checkoutForm, buyer_name: e.target.value })}
                    placeholder="ادخل اسمك الكامل"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 ps-10 pe-4 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground flex gap-1">
                  رقم الهاتف <span className="text-primary">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute start-3 top-3.5 w-4 h-4 text-muted-foreground" />
                  <input
                    type="tel"
                    required
                    value={checkoutForm.buyer_phone}
                    onChange={(e) => setCheckoutForm({ ...checkoutForm, buyer_phone: e.target.value })}
                    placeholder="ادخل رقم هاتفك الفعال"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 ps-10 pe-4 text-sm text-white focus:outline-none focus:border-primary transition-colors text-start"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">
                  البريد الإلكتروني <span className="text-white/30">(اختياري)</span>
                </label>
                <div className="relative">
                  <Mail className="absolute start-3 top-3.5 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={checkoutForm.buyer_email}
                    onChange={(e) => setCheckoutForm({ ...checkoutForm, buyer_email: e.target.value })}
                    placeholder="name@example.com"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 ps-10 pe-4 text-sm text-white focus:outline-none focus:border-primary transition-colors text-start"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">ملاحظات إضافية</label>
                <div className="relative">
                  <FileText className="absolute start-3 top-3 w-4 h-4 text-muted-foreground" />
                  <textarea
                    value={checkoutForm.notes}
                    onChange={(e) => setCheckoutForm({ ...checkoutForm, notes: e.target.value })}
                    placeholder="اي تفاصيل اضافية للطلب..."
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 ps-10 pe-4 text-sm text-white focus:outline-none focus:border-primary transition-colors resize-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCheckoutOpen(false)}
                  className="flex-1 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-xs hover:bg-white/10 transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={checkoutMutation.isPending}
                  className="flex-1 py-3.5 rounded-xl bg-primary text-white font-black text-xs hover:opacity-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                >
                  {checkoutMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "تأكيد وحجز الطلب"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Select Option Dialog */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setSelectedProduct(null)} className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

          <div className="relative glass-card max-w-md w-full p-6 border border-white/5 z-10">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-5">
              <h2 className="text-base font-black truncate">{selectedProduct.name}</h2>
              <button
                onClick={() => setSelectedProduct(null)}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-2">اختر الحجم / الخيار المتاح:</label>
                <div className="grid grid-cols-2 gap-3">
                  {selectedProduct.options.map((opt) => {
                    const isSelected = selectedOption?.id === opt.id;
                    const optPrice = parseFloat(selectedProduct.price) + parseFloat(opt.additional_price);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedOption(opt)}
                        className={cn(
                          "p-3 rounded-2xl border text-xs text-start transition-all relative overflow-hidden flex flex-col justify-between min-h-[4rem]",
                          isSelected
                            ? "border-primary bg-primary/10 text-white"
                            : "border-white/5 bg-white/[0.01] hover:bg-white/5 text-muted-foreground hover:text-white"
                        )}
                      >
                        <span className="font-bold">{opt.value}</span>
                        <span className={cn("text-[10px] font-black mt-2", isSelected ? "text-primary" : "text-muted-foreground")}>
                          {formatCurrency(optPrice, currency)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-xs hover:bg-white/10 transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => selectedOption && addToCart(selectedProduct, selectedOption)}
                  disabled={!selectedOption}
                  className="flex-1 py-3 rounded-xl bg-primary text-white font-black text-xs hover:opacity-95 transition-all disabled:opacity-50"
                >
                  إضافة السلة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
