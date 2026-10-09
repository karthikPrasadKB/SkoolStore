"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Banknote, GraduationCap, Minus, Plus, Search, ShoppingBag, Smartphone, Tag, Trash2, UserRound, UtensilsCrossed, Wallet, WalletCards } from "lucide-react";
import { CustomiseDialog, type MenuGroup as PosGroup, type MenuOption as PosOption, type MenuProduct as PosProduct } from "@/components/customise-dialog";
import { FoodTypeMark } from "@/components/food-type-mark";
import { Alert } from "@/components/ui";
import { formatINR, imageUrl, type Category } from "@/lib/menu";
import { createCounterOrder, lookupCustomer, lookupStudent, type CustomerMatch, type SaleInput, type StudentMatch } from "./actions";
import { SaleComplete, type CompletedSale } from "./sale-complete";
import { StudentCard, walletSpendable } from "./student-card";

export type { PosGroup, PosOption, PosProduct };

type CartLine = {
  key: string;
  product: PosProduct;
  optionIds: string[];
  optionLabel: string;
  unitPrice: number;
  quantity: number;
};

type PaymentMethod = SaleInput["payment_method"];

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "upi", label: "UPI", icon: Smartphone },
  { value: "pluxee", label: "Pluxee", icon: WalletCards },
];

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";

export function Pos({
  products,
  categories,
  maxDiscountPercent,
  useCanteenCodes,
}: {
  products: PosProduct[];
  categories: Category[];
  maxDiscountPercent: number;
  useCanteenCodes: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customising, setCustomising] = useState<PosProduct | null>(null);
  const [showCustomer, setShowCustomer] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [showStudent, setShowStudent] = useState(false);
  const [studentCode, setStudentCode] = useState("");
  const [student, setStudent] = useState<StudentMatch>(null);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [lookingUp, startLookup] = useTransition();
  const [customer, setCustomer] = useState<CustomerMatch>(null);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountType, setDiscountType] = useState<"amount" | "percent">("amount");
  const [discountValue, setDiscountValue] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [received, setReceived] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<CompletedSale | null>(null);

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter(
      (p) => (!category || p.category_id === category) && (!term || p.name.toLowerCase().includes(term)),
    );
  }, [products, category, search]);

  const inCart = (productId: string) =>
    cart.filter((line) => line.product.id === productId).reduce((sum, line) => sum + line.quantity, 0);
  const remainingFor = (product: PosProduct) =>
    product.remaining === null ? null : product.remaining - inCart(product.id);

  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const discountNumber = Number(discountValue) || 0;
  const discount = Math.min(
    Math.round((discountType === "percent" ? (subtotal * discountNumber) / 100 : discountNumber) * 100) / 100,
    subtotal,
  );
  const maxDiscount = Math.round(subtotal * maxDiscountPercent) / 100;
  const discountTooBig = discount > maxDiscount;
  const total = Math.round((subtotal - discount) * 100) / 100;
  const receivedNumber = received === "" ? total : Number(received);
  const change = receivedNumber - total;

  // Wallet payment is offered only when a student is found and the parent's rules allow this bill.
  const spendable = student ? walletSpendable(student) : 0;
  let walletProblem: string | null = null;
  if (student) {
    if (!student.has_wallet) walletProblem = "No wallet";
    else if (!student.wallet_allowed) walletProblem = "Not allowed";
    else if (student.balance < total) walletProblem = "Low balance";
    else if (spendable < total) walletProblem = "Daily limit";
  }

  function addToCart(product: PosProduct, options: PosOption[], quantity: number) {
    const optionIds = options.map((o) => o.id).sort();
    const key = `${product.id}:${optionIds.join(",")}`;
    const unitPrice = product.price + options.reduce((sum, o) => sum + o.price_delta, 0);
    setError(null);
    setCart((current) => {
      const existing = current.find((line) => line.key === key);
      if (existing) {
        return current.map((line) => (line.key === key ? { ...line, quantity: line.quantity + quantity } : line));
      }
      return [
        ...current,
        { key, product, optionIds, optionLabel: options.map((o) => o.name).join(", "), unitPrice, quantity },
      ];
    });
  }

  function tapProduct(product: PosProduct) {
    if (product.groups.length > 0) setCustomising(product);
    else addToCart(product, [], 1);
  }

  function changeQuantity(key: string, delta: number) {
    setCart((current) =>
      current
        .map((line) => (line.key === key ? { ...line, quantity: line.quantity + delta } : line))
        .filter((line) => line.quantity > 0),
    );
  }

  function enterStudentCode(value: string) {
    // ID card numbers can contain letters, digits, "/" and "-" (e.g. "2024/0153").
    setStudentCode(value.toUpperCase().replace(/[^A-Z0-9/-]/g, "").slice(0, 30));
    setStudent(null);
    setStudentError(null);
  }

  function findStudent() {
    if (!studentCode) {
      setStudentError(useCanteenCodes ? "Enter the ID card number or store code." : "Enter the ID card number.");
      return;
    }
    startLookup(async () => {
      const match = await lookupStudent(studentCode);
      if (match) setStudent(match);
      else setStudentError(useCanteenCodes ? "No student with that ID number or code." : "No student with that ID card number.");
    });
  }

  function enterCustomerPhone(value: string) {
    const phone = value.replace(/[^\d+\s-]/g, "").slice(0, 16);
    setCustomerPhone(phone);
    setCustomer(null);
    setCustomerError(null);
    if (phone.replace(/\D/g, "").length >= 10) {
      startLookup(async () => {
        const match = await lookupCustomer(phone);
        if (!match) {
          setCustomerError("Enter a valid 10-digit mobile number.");
          return;
        }
        setCustomer(match);
        if (match.name) setCustomerName(match.name);
      });
    }
  }

  function clearCustomer() {
    setShowCustomer(false);
    setCustomerPhone("");
    setCustomerName("");
    setCustomer(null);
    setCustomerError(null);
  }

  // A sale is tagged to a student or a customer, never both.
  function toggleStudent() {
    if (showStudent) {
      clearStudent();
    } else {
      clearCustomer();
      setShowStudent(true);
    }
  }

  function toggleCustomer() {
    if (showCustomer) {
      clearCustomer();
    } else {
      clearStudent();
      setShowCustomer(true);
    }
  }

  function clearStudent() {
    setPayment((current) => (current === "wallet" ? "cash" : current));
    setShowStudent(false);
    setStudentCode("");
    setStudent(null);
    setStudentError(null);
  }

  function resetSale() {
    clearStudent();
    clearCustomer();
    setCart([]);
    setShowDiscount(false);
    setDiscountValue("");
    setDiscountReason("");
    setPayment("cash");
    setReceived("");
    setError(null);
    setCompleted(null);
  }

  function completeSale() {
    setError(null);
    if (showStudent && studentCode && !student) {
      setError("Find the student first, or remove the student.");
      return;
    }
    if (showCustomer && customerPhone && !customer) {
      setError("Enter a valid mobile number, or remove the customer.");
      return;
    }
    if (payment === "wallet" && (!student || walletProblem)) {
      setError("This bill can't be paid from the wallet. Choose another payment method.");
      return;
    }
    if (payment === "cash" && change < 0) {
      setError("Cash received is less than the total.");
      return;
    }
    const sale: SaleInput = {
      items: cart.map((line) => ({ product_id: line.product.id, quantity: line.quantity, option_ids: line.optionIds })),
      payment_method: payment,
      amount_received: payment === "cash" ? receivedNumber : null,
      discount_amount: discount,
      discount_reason: discountReason,
      customer_name: showCustomer ? customerName : "",
      customer_phone: showCustomer ? customer?.phone ?? "" : "",
      student_code: student?.code ?? "",
    };
    startTransition(async () => {
      const result = await createCounterOrder(sale);
      if (!result.ok) {
        setError(result.error);
        router.refresh();
        return;
      }
      setCompleted({ ...result, payment_method: payment, student_name: student?.name ?? null });
      // Keep the shown wallet balance in step until the next sale.
      if (payment === "wallet" && student) {
        setStudent({ ...student, balance: student.balance - result.total, spent_today: student.spent_today + result.total });
      }
      router.refresh();
    });
  }

  // Quick cash buttons: exact amount and the next round notes above it.
  const cashSuggestions = [...new Set([total, ...[50, 100, 200, 500].map((note) => Math.ceil(total / note) * note)])]
    .filter((amount) => amount >= total && amount > 0)
    .slice(0, 4);

  const tabClass = (active: boolean) =>
    `whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition ${
      active ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
    }`;

  return (
    <div data-fullbleed className="grid min-h-screen lg:grid-cols-[1fr_400px]">
      {/* Menu */}
      <section className="min-w-0 px-4 py-6 md:px-8">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">New sale</h1>
          <div className="relative ml-auto w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items"
              className={`${inputClass} pl-9`}
            />
          </div>
        </div>

        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setCategory(null)} className={tabClass(category === null)}>All</button>
          {categories.map((c) => (
            <button key={c.id} onClick={() => setCategory(c.id)} className={tabClass(category === c.id)}>
              {c.name}
            </button>
          ))}
        </div>

        {visibleProducts.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center text-slate-500">
            {products.length === 0 ? "No items on the menu yet. Add some in Menu & stock." : "No items match."}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {visibleProducts.map((product) => {
              const left = remainingFor(product);
              const soldOut = left !== null && left <= 0;
              const src = imageUrl(product.image_path);
              return (
                <button
                  key={product.id}
                  onClick={() => tapProduct(product)}
                  disabled={soldOut}
                  className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  <div className="relative aspect-[4/3] bg-slate-100">
                    {src ? (
                      <Image src={src} alt="" fill sizes="200px" className="object-cover" />
                    ) : (
                      <UtensilsCrossed className="absolute inset-0 m-auto h-8 w-8 text-slate-300" />
                    )}
                    {left !== null && (
                      <span
                        className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-bold ${
                          soldOut ? "bg-red-600 text-white" : left <= 5 ? "bg-amber-400 text-amber-950" : "bg-white/90 text-slate-700"
                        }`}
                      >
                        {soldOut ? "Sold out" : `${left} left`}
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="flex items-start gap-1.5 text-sm font-semibold leading-snug text-slate-900">
                      <FoodTypeMark type={product.food_type} className="mt-0.5 h-3.5 w-3.5" />
                      {product.name}
                    </p>
                    <p className="mt-1 font-bold text-slate-900">
                      {formatINR(product.price)}
                      {product.groups.length > 0 && <span className="ml-1 text-xs font-medium text-slate-400">+ options</span>}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Cart */}
      <aside className="flex flex-col border-t border-slate-200 bg-white lg:sticky lg:top-0 lg:h-screen lg:border-l lg:border-t-0">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="flex items-center gap-2 font-bold">
            <ShoppingBag className="h-5 w-5 text-brand-600" /> Current sale
          </h2>
          {cart.length > 0 && (
            <button onClick={resetSale} className="text-sm font-semibold text-slate-500 hover:text-red-600">
              Clear
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {cart.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">Tap items on the left to add them.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {cart.map((line) => {
                const left = remainingFor(line.product);
                return (
                  <li key={line.key} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{line.product.name}</p>
                      {line.optionLabel && <p className="truncate text-xs text-slate-500">{line.optionLabel}</p>}
                      <p className="text-xs text-slate-500">{formatINR(line.unitPrice)} each</p>
                    </div>
                    <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
                      <button onClick={() => changeQuantity(line.key, -1)} className="rounded-lg p-1.5 hover:bg-white" title="One less">
                        {line.quantity === 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                      </button>
                      <span className="w-6 text-center text-sm font-bold">{line.quantity}</span>
                      <button
                        onClick={() => changeQuantity(line.key, 1)}
                        disabled={left !== null && left <= 0}
                        className="rounded-lg p-1.5 hover:bg-white disabled:opacity-30"
                        title="One more"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="w-16 text-right text-sm font-bold">{formatINR(line.unitPrice * line.quantity)}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-3 border-t border-slate-200 px-5 py-4">
          {/* Student (optional): saves the sale to the student's account */}
          {showStudent &&
            (student ? (
              <StudentCard
                student={student}
                showCode={useCanteenCodes}
                onRemove={clearStudent}
                onBalanceChange={(balance) => setStudent({ ...student, balance })}
              />
            ) : (
              <div>
                <div className="flex gap-2">
                  <input
                    value={studentCode}
                    onChange={(e) => enterStudentCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && findStudent()}
                    autoFocus
                    autoCapitalize="characters"
                    autoComplete="off"
                    placeholder={useCanteenCodes ? "ID card number or store code" : "ID card number"}
                    className={`${inputClass} font-mono uppercase tracking-widest`}
                  />
                  <button
                    onClick={findStudent}
                    disabled={lookingUp}
                    className="shrink-0 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
                  >
                    Find
                  </button>
                </div>
                {lookingUp && <p className="mt-1 text-xs text-slate-500">Looking up…</p>}
                {studentError && <p className="mt-1 text-xs text-red-600">{studentError}</p>}
              </div>
            ))}

          {/* Customer (optional) */}
          {showCustomer && (
            <div className="space-y-2">
              <input
                value={customerPhone}
                onChange={(e) => enterCustomerPhone(e.target.value)}
                placeholder="Customer's mobile number"
                type="tel"
                inputMode="tel"
                autoFocus
                className={inputClass}
              />
              {customer && (
                <>
                  <p className={`text-xs font-semibold ${customer.found ? "text-emerald-700" : "text-brand-700"}`}>
                    {customer.found ? "✓ Returning customer" : "New customer: they'll be saved with this sale"}
                  </p>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Name (optional)"
                    maxLength={100}
                    className={inputClass}
                  />
                </>
              )}
              {customerError && <p className="text-xs text-red-600">{customerError}</p>}
            </div>
          )}

          {/* Discount (optional) */}
          {showDiscount && (
            <div className="space-y-2 rounded-xl bg-slate-50 p-3">
              <div className="flex gap-2">
                <div className="flex rounded-xl border border-slate-300 bg-white p-0.5 text-sm font-semibold">
                  {(["amount", "percent"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setDiscountType(type)}
                      className={`rounded-lg px-3 py-1 ${discountType === type ? "bg-slate-900 text-white" : "text-slate-600"}`}
                    >
                      {type === "amount" ? "₹" : "%"}
                    </button>
                  ))}
                </div>
                <input
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  type="number"
                  min="0"
                  inputMode="decimal"
                  placeholder={discountType === "amount" ? "Amount off" : "Percent off"}
                  className={inputClass}
                />
              </div>
              <input value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} placeholder="Reason (optional), e.g. Teacher" maxLength={200} className={inputClass} />
              {discountTooBig && <p className="text-xs text-red-600">The maximum discount you can give is {maxDiscountPercent}%.</p>}
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-sm">
            <button
              onClick={toggleStudent}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-semibold ${showStudent ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"}`}
            >
              <GraduationCap className="h-4 w-4" /> Student
            </button>
            <button
              onClick={toggleCustomer}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-semibold ${showCustomer ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"}`}
            >
              <UserRound className="h-4 w-4" /> Customer
            </button>
            {maxDiscountPercent > 0 && (
              <button
                onClick={() => {
                  setShowDiscount((v) => !v);
                  setDiscountValue("");
                }}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-semibold ${showDiscount ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"}`}
              >
                <Tag className="h-4 w-4" /> Discount
              </button>
            )}
          </div>

          {/* Totals */}
          <div className="space-y-1 text-sm">
            {discount > 0 && (
              <>
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span>{formatINR(subtotal)}</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>Discount</span>
                  <span>−{formatINR(discount)}</span>
                </div>
              </>
            )}
            <div className="flex items-baseline justify-between">
              <span className="font-semibold text-slate-700">Total</span>
              <span className="text-3xl font-extrabold tracking-tight">{formatINR(total)}</span>
            </div>
          </div>

          {/* Payment */}
          <div className={`grid gap-2 ${student ? "grid-cols-4" : "grid-cols-3"}`}>
            {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setPayment(value)}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 py-2.5 text-sm font-bold transition ${
                  payment === value ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            ))}
            {student && (
              <button
                onClick={() => setPayment("wallet")}
                disabled={Boolean(walletProblem) && total > 0}
                title={walletProblem ?? "Pay from the family wallet"}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  payment === "wallet" ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                <Wallet className="h-5 w-5" />
                {walletProblem && total > 0 ? <span className="text-[10px] leading-tight">{walletProblem}</span> : "Wallet"}
              </button>
            )}
          </div>

          {payment === "wallet" && student && total > 0 && (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              {formatINR(total)} will be taken from the wallet. Balance after: {formatINR(student.balance - total)}.
            </p>
          )}

          {payment === "cash" && total > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {cashSuggestions.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setReceived(String(amount))}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ${
                      receivedNumber === amount ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {amount === total ? "Exact" : formatINR(amount)}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={received}
                  onChange={(e) => setReceived(e.target.value)}
                  type="number"
                  min="0"
                  inputMode="decimal"
                  placeholder={`Cash received (${formatINR(total)})`}
                  className={inputClass}
                />
                <div className={`shrink-0 text-right text-sm ${change < 0 ? "text-red-600" : "text-slate-700"}`}>
                  <p className="text-xs text-slate-500">Change</p>
                  <p className="font-bold">{change < 0 ? "Short" : formatINR(change)}</p>
                </div>
              </div>
            </div>
          )}

          {(payment === "upi" || payment === "pluxee") && total > 0 && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Check that {formatINR(total)} has been received {payment === "upi" ? "on UPI" : "on the Pluxee machine or app"} before completing.
            </p>
          )}

          {error && <Alert kind="error">{error}</Alert>}

          <button
            onClick={completeSale}
            disabled={cart.length === 0 || pending || discountTooBig}
            className="w-full rounded-xl bg-brand-600 py-3.5 text-lg font-bold text-white shadow-sm shadow-brand-600/30 transition hover:bg-brand-700 disabled:opacity-50"
          >
            {pending ? "Saving…" : cart.length === 0 ? "Add items to start" : `Complete sale · ${formatINR(total)}`}
          </button>
        </div>
      </aside>

      {customising && (
        <CustomiseDialog
          product={customising}
          remaining={remainingFor(customising)}
          onClose={() => setCustomising(null)}
          onAdd={(options, quantity) => {
            addToCart(customising, options, quantity);
            setCustomising(null);
          }}
        />
      )}

      {completed && <SaleComplete sale={completed} onNewSale={resetSale} />}
    </div>
  );
}
