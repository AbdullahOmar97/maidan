"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ShoppingBag,
  ShoppingCart,
  Package,
  Plus,
  Loader2,
  Trash2,
  Check,
  X,
  Edit2,
  Settings,
  ChevronRight,
  TrendingUp,
  Inbox,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  Eye,
} from "lucide-react";
import type { Product, Order, ProductOption } from "@/types";

export default function StorePage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const isStaff = user && !["parent", "student"].includes(user.role);

  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"catalog" | "orders" | "manage-orders" | "manage-products">("catalog");

  // State for shopping cart
  const [cart, setCart] = useState<{ product: Product; option?: ProductOption; quantity: number }[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [notes, setNotes] = useState("");

  // Product Management Modal State
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    price: "",
    is_active: true,
  });

  // Product Option Modal State
  const [optionModalOpen, setOptionModalOpen] = useState(false);
  const [optionProduct, setOptionProduct] = useState<Product | null>(null);
  const [optionForm, setOptionForm] = useState({
    name: "الحجم", // Size by default
    value: "",
    additional_price: "0.00",
    stock: "10",
  });

  // Order Detail Modal State
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);

  // Queries
  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["store", "products"],
    queryFn: async () => {
      const res = await api.store.products.list();
      return Array.isArray(res.data) ? res.data : (res.data as any).results || [];
    },
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["store", "orders"],
    queryFn: async () => {
      const res = await api.store.orders.list();
      return Array.isArray(res.data) ? res.data : (res.data as any).results || [];
    },
  });

  // Mutations
  const createProductMutation = useMutation({
    mutationFn: (data: any) => api.store.products.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store", "products"] });
      toast.success("تم إضافة المنتج بنجاح.");
      setProductModalOpen(false);
    },
    onError: () => toast.error("حدث خطأ أثناء إضافة المنتج."),
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.store.products.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store", "products"] });
      toast.success("تم تحديث المنتج بنجاح.");
      setProductModalOpen(false);
    },
    onError: () => toast.error("حدث خطأ أثناء تحديث المنتج."),
  });

  const addOptionMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.store.products.addOption(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store", "products"] });
      toast.success("تم إضافة الخيار بنجاح.");
      setOptionModalOpen(false);
    },
    onError: () => toast.error("حدث خطأ أثناء إضافة الخيار."),
  });

  const placeOrderMutation = useMutation({
    mutationFn: (data: any) => api.store.orders.create(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["store", "orders"] });
      toast.success("تم تقديم الطلب بنجاح وإنشاء الفاتورة.");
      setCart([]);
      setNotes("");
      setCartOpen(false);
      // If student/parent, switch to orders tab
      if (!isStaff) setActiveTab("orders");
    },
    onError: (err: any) => {
      const errMsg = err.response?.data?.error?.message || "حدث خطأ أثناء إتمام الطلب.";
      toast.error(errMsg);
    },
  });

  const cancelOrderMutation = useMutation({
    mutationFn: (id: number) => api.store.orders.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store", "orders"] });
      toast.success("تم إلغاء الطلب وإرجاع المنتجات للمخزون.");
    },
    onError: () => toast.error("حدث خطأ أثناء إلغاء الطلب."),
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { status?: string; payment_status?: string } }) =>
      api.store.orders.updateStatus(id, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["store", "orders"] });
      toast.success("تم تحديث حالة الطلب/الدفع بنجاح.");
      if (selectedOrder && selectedOrder.id === res.data.id) {
        setSelectedOrder(res.data);
      }
    },
    onError: () => toast.error("حدث خطأ أثناء تحديث الحالة."),
  });

  // Cart Helper Functions
  const addToCart = (product: Product, option?: ProductOption) => {
    // Check if item already in cart
    const existingIndex = cart.findIndex(
      (item) => item.product.id === product.id && item.option?.id === option?.id
    );

    if (existingIndex > -1) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      setCart(newCart);
    } else {
      setCart([...cart, { product, option, quantity: 1 }]);
    }
    toast.success(`تم إضافة ${product.name} إلى السلة.`);
  };

  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  const updateCartQty = (index: number, change: number) => {
    const newCart = [...cart];
    newCart[index].quantity += change;
    if (newCart[index].quantity <= 0) {
      newCart.splice(index, 1);
    }
    setCart(newCart);
  };

  const checkout = () => {
    if (!user) return toast.error("يجب تسجيل الدخول لإتمام الطلب.");
    
    // Find active student profile for user
    const studentProfileId = user.student_profile?.id;
    if (!studentProfileId && !isStaff) {
      return toast.error("لا تملك ملف طالب مرتبط لتقديم الطلب.");
    }

    const payload = {
      student: studentProfileId || orders[0]?.student, // Default to first student if staff ordering
      payment_method: "cash",
      notes,
      items: cart.map((item) => ({
        product: item.product.id,
        option: item.option?.id || null,
        quantity: item.quantity,
      })),
    };

    placeOrderMutation.mutate(payload);
  };

  // Pricing Helpers
  const getItemPrice = (product: Product, option?: ProductOption) => {
    return parseFloat(product.price) + (option ? parseFloat(option.additional_price) : 0);
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + getItemPrice(item.product, item.option) * item.quantity, 0);
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      <PageHeader
        title="متجر الأكاديمية"
        description="شراء المعدات الرياضية، الأحزمة، والملابس الخاصة بالنادي بسلاسة."
      >
        <div className="flex gap-2">
          {isStaff && (
            <button
              onClick={() => {
                setEditingProduct(null);
                setProductForm({ name: "", description: "", price: "", is_active: true });
                setProductModalOpen(true);
              }}
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/95 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 touch-target"
            >
              <Plus className="w-4 h-4" />
              إضافة منتج
            </button>
          )}
          <button
            onClick={() => setCartOpen(true)}
            className="relative inline-flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 touch-target"
          >
            <ShoppingCart className="w-4 h-4" />
            السلة
            {cart.length > 0 && (
              <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center animate-bounce">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </PageHeader>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/5 pb-px overflow-x-auto">
        <button
          onClick={() => setActiveTab("catalog")}
          className={cn(
            "px-4 py-2.5 text-sm font-black transition-all border-b-2",
            activeTab === "catalog"
              ? "border-primary text-white"
              : "border-transparent text-muted-foreground hover:text-white"
          )}
        >
          المنتجات والمعروضات
        </button>

        {!isStaff && (
          <button
            onClick={() => setActiveTab("orders")}
            className={cn(
              "px-4 py-2.5 text-sm font-black transition-all border-b-2",
              activeTab === "orders"
                ? "border-primary text-white"
                : "border-transparent text-muted-foreground hover:text-white"
            )}
          >
            طلباتي وتاريخ الشراء
          </button>
        )}

        {isStaff && (
          <>
            <button
              onClick={() => setActiveTab("manage-orders")}
              className={cn(
                "px-4 py-2.5 text-sm font-black transition-all border-b-2",
                activeTab === "manage-orders"
                  ? "border-primary text-white"
                  : "border-transparent text-muted-foreground hover:text-white"
              )}
            >
              إدارة طلبات الأندية
            </button>

            <button
              onClick={() => setActiveTab("manage-products")}
              className={cn(
                "px-4 py-2.5 text-sm font-black transition-all border-b-2",
                activeTab === "manage-products"
                  ? "border-primary text-white"
                  : "border-transparent text-muted-foreground hover:text-white"
              )}
            >
              إدارة المخزون والتسعير
            </button>
          </>
        )}
      </div>

      {/* TAB 1: PRODUCT CATALOG */}
      {activeTab === "catalog" && (
        <div>
          {productsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 bg-white/[0.02] border border-white/5 rounded-2xl">
              <Inbox className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-bold">لا توجد منتجات معروضة حالياً.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products
                .filter((p) => p.is_active)
                .map((product) => (
                  <div
                    key={product.id}
                    className="group bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 rounded-2xl p-5 transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Placeholder Image or Uploaded image */}
                      <div className="aspect-video w-full rounded-xl bg-white/5 mb-4 flex items-center justify-center text-muted-foreground overflow-hidden">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <ShoppingBag className="w-10 h-10 opacity-40" />
                        )}
                      </div>

                      <h3 className="font-black text-lg text-white mb-1">{product.name}</h3>
                      <p className="text-sm text-muted-foreground mb-4 min-h-[40px]">
                        {product.description || "لا يوجد وصف للمنتج."}
                      </p>

                      {/* Display pricing */}
                      <div className="flex items-baseline justify-between mb-4">
                        <span className="text-xs font-bold text-muted-foreground">السعر الأساسي</span>
                        <span className="font-black text-xl text-primary">
                          {formatCurrency(parseFloat(product.price), product.currency)}
                        </span>
                      </div>
                    </div>

                    {/* Options Selection */}
                    <div className="space-y-4">
                      {product.options && product.options.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-muted-foreground">اختر الحجم/الخيار:</p>
                          <div className="grid grid-cols-2 gap-2">
                            {product.options.map((opt) => {
                              const isOutOfStock = opt.stock === 0;
                              const finalPrice = getItemPrice(product, opt);
                              return (
                                <button
                                  key={opt.id}
                                  disabled={isOutOfStock}
                                  onClick={() => addToCart(product, opt)}
                                  className={cn(
                                    "flex flex-col items-center justify-center p-2 rounded-xl text-xs font-bold border transition-all touch-target",
                                    isOutOfStock
                                      ? "bg-transparent border-white/5 text-muted-foreground opacity-50 cursor-not-allowed"
                                      : "bg-white/5 border-white/10 text-white hover:bg-primary/10 hover:border-primary"
                                  )}
                                >
                                  <span>{opt.value}</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {formatCurrency(finalPrice, product.currency)}
                                  </span>
                                  <span
                                    className={cn(
                                      "text-[9px] mt-0.5",
                                      opt.stock < 3 ? "text-amber-400 font-bold" : "text-emerald-400"
                                    )}
                                  >
                                    {isOutOfStock ? "نفذ" : `متاح: ${opt.stock}`}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(product)}
                          className="w-full bg-primary hover:bg-primary/90 text-white py-2.5 rounded-xl text-sm font-black transition-all active:scale-95 touch-target flex items-center justify-center gap-2"
                        >
                          <ShoppingCart className="w-4 h-4" />
                          إضافة إلى السلة
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MY ORDERS (CLIENT ONLY) */}
      {activeTab === "orders" && !isStaff && (
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
          {ordersLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <Inbox className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-bold">لم تقم بإجراء أي طلبات شراء بعد.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.01]">
                    <th className="py-3 px-5 text-sm font-black text-muted-foreground">رقم الطلب</th>
                    <th className="py-3 px-5 text-sm font-black text-muted-foreground">التاريخ</th>
                    <th className="py-3 px-5 text-sm font-black text-muted-foreground">الفاتورة</th>
                    <th className="py-3 px-5 text-sm font-black text-muted-foreground">المبلغ الإجمالي</th>
                    <th className="py-3 px-5 text-sm font-black text-muted-foreground">حالة الطلب</th>
                    <th className="py-3 px-5 text-sm font-black text-muted-foreground">الدفع</th>
                    <th className="py-3 px-5 text-sm font-black text-muted-foreground text-left">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.01] transition-colors">
                      <td className="py-4 px-5 text-sm font-black text-white">#{order.id}</td>
                      <td className="py-4 px-5 text-sm text-muted-foreground">{formatDate(order.created_at)}</td>
                      <td className="py-4 px-5 text-sm text-primary font-bold">{order.invoice_number || "-"}</td>
                      <td className="py-4 px-5 text-sm font-bold text-white">
                        {formatCurrency(parseFloat(order.total_amount), "JOD")}
                      </td>
                      <td className="py-4 px-5">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="py-4 px-5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold",
                            order.payment_status === "paid"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-amber-500/10 text-amber-400"
                          )}
                        >
                          {order.payment_status === "paid" ? "تم الدفع" : "معلق"}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-left">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-all active:scale-90 touch-target"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {order.status === "pending" && (
                            <button
                              onClick={() => cancelOrderMutation.mutate(order.id)}
                              className="px-3 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all text-xs font-bold touch-target"
                            >
                              إلغاء
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MANAGE ORDERS (STAFF ONLY) */}
      {activeTab === "manage-orders" && isStaff && (
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
          {ordersLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <Inbox className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-bold">لا توجد طلبات شراء مسجلة حالياً.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.01]">
                    <th className="py-3 px-5 text-sm font-black text-muted-foreground">رقم الطلب</th>
                    <th className="py-3 px-5 text-sm font-black text-muted-foreground">اسم الطالب</th>
                    <th className="py-3 px-5 text-sm font-black text-muted-foreground">التاريخ</th>
                    <th className="py-3 px-5 text-sm font-black text-muted-foreground">قيمة الطلب</th>
                    <th className="py-3 px-5 text-sm font-black text-muted-foreground">حالة الطلب</th>
                    <th className="py-3 px-5 text-sm font-black text-muted-foreground">الدفع</th>
                    <th className="py-3 px-5 text-sm font-black text-muted-foreground text-left">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.01] transition-colors">
                      <td className="py-4 px-5 text-sm font-black text-white">#{order.id}</td>
                      <td className="py-4 px-5 text-sm font-bold text-white">{order.student_name}</td>
                      <td className="py-4 px-5 text-sm text-muted-foreground">{formatDate(order.created_at)}</td>
                      <td className="py-4 px-5 text-sm font-bold text-white">
                        {formatCurrency(parseFloat(order.total_amount), "JOD")}
                      </td>
                      <td className="py-4 px-5">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="py-4 px-5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold",
                            order.payment_status === "paid"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-amber-500/10 text-amber-400"
                          )}
                        >
                          {order.payment_status === "paid" ? "تم السداد" : "معلق"}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-left">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-all active:scale-90 touch-target"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          
                          {/* Quick change status select */}
                          <select
                            defaultValue={order.status}
                            onChange={(e) =>
                              updateOrderStatusMutation.mutate({
                                id: order.id,
                                data: { status: e.target.value },
                              })
                            }
                            className="bg-white/5 border border-white/10 hover:border-primary text-white text-xs font-bold px-2 py-1 rounded-lg"
                          >
                            <option value="pending">معلق</option>
                            <option value="processing">جاري التجهيز</option>
                            <option value="ready">جاهز للاستلام</option>
                            <option value="completed">مكتمل</option>
                            <option value="cancelled">ملغى</option>
                          </select>

                          {order.payment_status !== "paid" && (
                            <button
                              onClick={() =>
                                updateOrderStatusMutation.mutate({
                                  id: order.id,
                                  data: { payment_status: "paid" },
                                })
                              }
                              className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all text-xs font-bold touch-target"
                            >
                              سداد
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MANAGE PRODUCTS (STAFF ONLY) */}
      {activeTab === "manage-products" && isStaff && (
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-black text-lg text-white">إدارة كتالوج المنتجات والمخازن</h3>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {products.map((product) => (
              <div
                key={product.id}
                className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-white/[0.01] border border-white/5 rounded-xl gap-4 hover:border-white/10 transition-colors"
              >
                <div>
                  <h4 className="font-bold text-white text-base flex items-center gap-2">
                    {product.name}
                    {!product.is_active && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-bold border border-red-500/20">
                        غير نشط
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {product.description || "لا يوجد وصف."}
                  </p>
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    <span>السعر: <b className="text-primary">{formatCurrency(parseFloat(product.price), product.currency)}</b></span>
                    <span>الخيارات المضافة: <b className="text-white">{product.options?.length || 0}</b></span>
                  </div>
                </div>

                <div className="flex gap-2 self-stretch md:self-auto justify-end">
                  <button
                    onClick={() => {
                      setOptionProduct(product);
                      setOptionForm({ name: "الحجم", value: "", additional_price: "0.00", stock: "10" });
                      setOptionModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-primary text-white text-xs font-bold transition-all active:scale-95 touch-target"
                  >
                    إضافة مقاس/خيار
                  </button>
                  <button
                    onClick={() => {
                      setEditingProduct(product);
                      setProductForm({
                        name: product.name,
                        description: product.description,
                        price: product.price,
                        is_active: product.is_active,
                      });
                      setProductModalOpen(true);
                    }}
                    className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-all active:scale-90 touch-target"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SHOPPING CART DRAWER */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCartOpen(false)} />

          {/* Drawer Content */}
          <div className="relative w-full max-w-md h-full bg-[#0d0e12] border-r border-white/5 p-6 flex flex-col justify-between animate-slide-in">
            <div>
              <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                <button onClick={() => setCartOpen(false)} className="text-muted-foreground hover:text-white p-1">
                  <X className="w-6 h-6" />
                </button>
                <h3 className="font-black text-xl text-white flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  سلة التسوق
                </h3>
              </div>

              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-3 opacity-40" />
                  <p className="text-muted-foreground font-bold">سلة التسوق فارغة حالياً.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                  {cart.map((item, idx) => {
                    const price = getItemPrice(item.product, item.option);
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl gap-4"
                      >
                        <div className="flex-1">
                          <h4 className="font-bold text-white text-sm">{item.product.name}</h4>
                          {item.option && (
                            <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-muted-foreground mt-1 inline-block">
                              {item.option.name}: {item.option.value}
                            </span>
                          )}
                          <p className="text-xs text-primary font-bold mt-1">
                            {formatCurrency(price, item.product.currency)}
                          </p>
                        </div>

                        {/* Qty Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateCartQty(idx, -1)}
                            className="w-7 h-7 rounded bg-white/5 hover:bg-white/10 text-white font-bold flex items-center justify-center active:scale-90"
                          >
                            -
                          </button>
                          <span className="text-sm font-bold text-white w-5 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateCartQty(idx, 1)}
                            className="w-7 h-7 rounded bg-white/5 hover:bg-white/10 text-white font-bold flex items-center justify-center active:scale-90"
                          >
                            +
                          </button>
                          <button
                            onClick={() => removeFromCart(idx)}
                            className="p-1.5 rounded text-red-400 hover:bg-red-500/10 mr-2"
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
              <div className="border-t border-white/5 pt-4 space-y-4">
                {/* Notes input */}
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">ملاحظات الطلب:</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="مثال: تفضيل مقاس معين أو موعد الاستلام..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary focus:outline-none min-h-[60px] resize-none"
                  />
                </div>

                <div className="flex justify-between items-center text-sm font-black text-white">
                  <span>المجموع الإجمالي</span>
                  <span className="text-xl text-primary">{formatCurrency(getCartTotal(), "JOD")}</span>
                </div>

                <button
                  onClick={checkout}
                  disabled={placeOrderMutation.isPending}
                  className="w-full bg-primary hover:bg-primary/95 text-white py-3 rounded-xl text-base font-black transition-all active:scale-95 touch-target flex items-center justify-center gap-2"
                >
                  {placeOrderMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "تأكيد الطلب والشراء"
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PRODUCT MODAL */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setProductModalOpen(false)} />
          <div className="relative w-full max-w-md bg-[#0d0e12] border border-white/5 rounded-2xl p-6 space-y-4">
            <h3 className="font-black text-lg text-white">
              {editingProduct ? "تعديل المنتج" : "إضافة منتج جديد"}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">اسم المنتج:</label>
                <input
                  type="text"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">الوصف:</label>
                <textarea
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary focus:outline-none min-h-[80px]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">السعر الأساسي (JOD):</label>
                <input
                  type="number"
                  value={productForm.price}
                  onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={productForm.is_active}
                  onChange={(e) => setProductForm({ ...productForm, is_active: e.target.checked })}
                  className="rounded bg-white/5 border-white/10 text-primary focus:ring-primary w-4 h-4"
                />
                <label htmlFor="is_active" className="text-xs font-bold text-white">المنتج متاح للبيع (نشط)</label>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setProductModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-sm font-bold touch-target"
              >
                إلغاء
              </button>
              <button
                onClick={() => {
                  if (editingProduct) {
                    updateProductMutation.mutate({ id: editingProduct.id, data: productForm });
                  } else {
                    createProductMutation.mutate(productForm);
                  }
                }}
                disabled={createProductMutation.isPending || updateProductMutation.isPending}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-bold touch-target flex items-center gap-2"
              >
                {(createProductMutation.isPending || updateProductMutation.isPending) && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                حفظ المنتج
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OPTION MODAL */}
      {optionModalOpen && optionProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOptionModalOpen(false)} />
          <div className="relative w-full max-w-md bg-[#0d0e12] border border-white/5 rounded-2xl p-6 space-y-4">
            <h3 className="font-black text-lg text-white">
              إضافة مقاس/خيار للمنتج: <span className="text-primary">{optionProduct.name}</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">نوع الخيار:</label>
                <input
                  type="text"
                  value={optionForm.name}
                  onChange={(e) => setOptionForm({ ...optionForm, name: e.target.value })}
                  placeholder="مثال: الحجم، اللون..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">قيمة الخيار:</label>
                <input
                  type="text"
                  value={optionForm.value}
                  onChange={(e) => setOptionForm({ ...optionForm, value: e.target.value })}
                  placeholder="مثال: M, L, XL, أحمر..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">فارق السعر الإضافي (JOD):</label>
                <input
                  type="number"
                  value={optionForm.additional_price}
                  onChange={(e) => setOptionForm({ ...optionForm, additional_price: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">كمية المخزون المتاحة:</label>
                <input
                  type="number"
                  value={optionForm.stock}
                  onChange={(e) => setOptionForm({ ...optionForm, stock: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setOptionModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-sm font-bold touch-target"
              >
                إلغاء
              </button>
              <button
                onClick={() => {
                  addOptionMutation.mutate({ id: optionProduct.id, data: optionForm });
                }}
                disabled={addOptionMutation.isPending}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-bold touch-target flex items-center gap-2"
              >
                {addOptionMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                حفظ الخيار
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ORDER DETAILS MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedOrder(null)} />
          <div className="relative w-full max-w-lg bg-[#0d0e12] border border-white/5 rounded-2xl p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <button onClick={() => setSelectedOrder(null)} className="text-muted-foreground hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-black text-lg text-white">تفاصيل الطلب #{selectedOrder.id}</h3>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm text-white">
              <div>
                <p className="text-xs text-muted-foreground">اسم الطالب</p>
                <p className="font-bold mt-1">{selectedOrder.student_name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">تاريخ الطلب</p>
                <p className="font-bold mt-1">{formatDate(selectedOrder.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">طريقة الدفع</p>
                <p className="font-bold mt-1">{selectedOrder.payment_method === "online" ? "دفع إلكتروني" : "دفع يدوي/نقدي"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">رقم الفاتورة</p>
                <p className="font-bold mt-1 text-primary">{selectedOrder.invoice_number || "-"}</p>
              </div>
            </div>

            {selectedOrder.notes && (
              <div className="bg-white/5 p-3 rounded-xl">
                <p className="text-xs text-muted-foreground">ملاحظات الطالب:</p>
                <p className="text-sm mt-1">{selectedOrder.notes}</p>
              </div>
            )}

            {/* Items list */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-muted-foreground">المنتجات المطلوبة:</p>
              <div className="border border-white/5 rounded-xl overflow-hidden divide-y divide-white/5">
                {selectedOrder.items?.map((item) => (
                  <div key={item.id} className="flex justify-between items-center p-3 text-sm text-white bg-white/[0.01]">
                    <div>
                      <p className="font-bold">{item.product_name}</p>
                      {item.option_value && (
                        <span className="text-[10px] text-muted-foreground">الحجم/الخيار: {item.option_value}</span>
                      )}
                    </div>
                    <div className="text-left">
                      <p className="font-bold">{item.quantity} x {formatCurrency(parseFloat(item.unit_price), "JOD")}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">الإجمالي: {formatCurrency(parseFloat(item.total_price), "JOD")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center border-t border-white/5 pt-4">
              <span className="text-sm font-bold text-muted-foreground">إجمالي قيمة الطلب</span>
              <span className="text-xl font-black text-primary">{formatCurrency(parseFloat(selectedOrder.total_amount), "JOD")}</span>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-sm font-bold touch-target"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
