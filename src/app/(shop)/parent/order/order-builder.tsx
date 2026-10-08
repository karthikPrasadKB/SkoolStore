"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CreditCard, Minus, Plus, Search, ShoppingBag, Trash2, UtensilsCrossed, Wallet, WalletCards } from "lucide-react";
import { CustomiseDialog, type MenuOption, type MenuProduct } from "@/components/customise-dialog";
import { FoodTypeMark } from "@/components/food-type-mark";
import { formatINR, imageUrl, type Category } from "@/lib/menu";
import { placePreorder } from "../actions";

type CartLine = {
  key: string;
  product: MenuProduct;
  optionIds: string[];
  optionLabel: string;
  unitPrice: number;
  quantity: number;
};

export function OrderBuilder({
  products,
  categories,
  balance,
  studentId,
  studentName,
  dayLabel,
  pickupDate,
  closesAt,
}: {
  products: MenuProduct[];
  categories: Category[];
  balance: number;
  studentId: string;
  studentName: string;
  dayLabel: string;
  pickupDate: string;
  closesAt: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customising, setCustomising] = useState<MenuProduct | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter(
      (p) => (!category || p.category_id === category) && (!term || p.name.toLowerCase().includes(term)),
    );
  }, [products, category, search]);
  const usedCategories = categories.filter((c) => products.some((p) => p.category_id === c.id));

  const inCart = (id: string) => cart.filter((l) => l.product.id === id).reduce((sum, l) => sum + l.quantity, 0);
  const remainingFor = (p: MenuProduct) => (p.remaining === null ? null : p.remaining - inCart(p.id));
  const total = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const itemCount = cart.reduce((sum, l) => sum + l.quantity, 0);
  const shortBy = total - balance;

  function addToCart(product: MenuProduct, options: MenuOption[], quantity: number) {
    const optionIds = options.map((o) => o.id).sort();
    const key = `${product.id}:${optionIds.join(",")}`;
    const unitPrice = product.price + options.reduce((sum, o) => sum + o.price_delta, 0);
    setError(null);
    setCart((current) =>
      current.some((l) => l.key === key)
        ? current.map((l) => (l.key === key ? { ...l, quantity: l.quantity + quantity } : l))
        : [...current, { key, product, optionIds, optionLabel: options.map((o) => o.name).join(", "), unitPrice, quantity }],
    );
  }

  function changeQuantity(key: string, delta: number) {
    setCart((current) =>
      current.map((l) => (l.key === key ? { ...l, quantity: l.quantity + delta } : l)).filter((l) => l.quantity > 0),
    );
  }

  function placeOrder() {
    setError(null);
    startTransition(async () => {
      const result = await placePreorder({
        student_id: studentId,
        pickup_date: pickupDate,
        items: cart.map((l) => ({ product_id: l.product.id, quantity: l.quantity, option_ids: l.optionIds })),
      });
      if (!result.ok) {
        setError(result.error);
        router.refresh();
        return;
      }
      router.push(`/parent/orders?placed=${result.bill_number}`);
    });
  }

  const tabClass = (active: boolean) =>
    `whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition ${
      active ? "bg-accent-500 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
    }`;

  const cartPanel = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 font-bold">
            <ShoppingBag className="h-5 w-5 text-accent-500" /> Your order
          </h2>
          <p className="text-xs text-slate-500">
            For {studentName} · {dayLabel}
          </p>
        </div>
        <button onClick={() => setShowCart(false)} className="text-sm font-semibold text-slate-500 lg:hidden">
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3">
        {cart.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">Your cart is empty.</p>
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
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-3 border-t border-slate-200 px-5 py-4">
        <div className="flex items-baseline justify-between">
          <span className="font-semibold text-slate-700">Total</span>
          <span className="text-2xl font-extrabold">{formatINR(total)}</span>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Pay with</p>
          <div className="space-y-2">
            <div className="flex items-center gap-3 rounded-xl border-2 border-accent-500 bg-accent-50 px-3 py-2.5">
              <Wallet className="h-5 w-5 text-accent-600" />
              <span className="flex-1 text-sm font-semibold text-slate-900">Wallet</span>
              <span className="text-sm font-semibold text-slate-600">Balance {formatINR(balance)}</span>
            </div>
            {[
              { label: "Card / UPI", icon: CreditCard },
              { label: "Pluxee", icon: WalletCards },
            ].map(({ label, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 opacity-50">
                <Icon className="h-5 w-5 text-slate-400" />
                <span className="flex-1 text-sm font-semibold text-slate-600">{label}</span>
                <span className="text-xs font-semibold text-slate-500">Coming soon</span>
              </div>
            ))}
          </div>
        </div>

        {cart.length > 0 && shortBy > 0 && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Your wallet is {formatINR(shortBy)} short. Top up at the canteen counter with cash or UPI.
          </p>
        )}
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button
          onClick={placeOrder}
          disabled={cart.length === 0 || pending || shortBy > 0}
          className="w-full rounded-xl bg-accent-500 py-3.5 text-lg font-bold text-white shadow-sm shadow-accent-500/30 transition hover:bg-accent-600 disabled:opacity-50"
        >
          {pending ? "Placing order…" : cart.length === 0 ? "Add items" : `Place order · ${formatINR(total)}`}
        </button>
        <p className="text-center text-xs text-slate-500">Orders for {dayLabel.toLowerCase()} close at {closesAt}.</p>
      </div>
    </div>
  );

  return (
    <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-6">
      <section className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex flex-1 gap-2 overflow-x-auto pb-1">
            <button onClick={() => setCategory(null)} className={tabClass(category === null)}>All</button>
            {usedCategories.map((c) => (
              <button key={c.id} onClick={() => setCategory(c.id)} className={tabClass(category === c.id)}>
                {c.name}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search the menu"
              className="w-full rounded-full border border-slate-200 bg-slate-100 py-2 pl-9 pr-4 text-sm outline-none focus:border-accent-400 focus:bg-white"
            />
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-slate-200 px-6 py-14 text-center text-slate-500">
            {products.length === 0 ? "Nothing on the menu for this day yet." : "No items match."}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {visible.map((product) => {
              const left = remainingFor(product);
              const soldOut = left !== null && left <= 0;
              const src = imageUrl(product.image_path);
              return (
                <div key={product.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="relative aspect-[4/3] bg-slate-100">
                    {src ? (
                      <Image src={src} alt="" fill sizes="(min-width: 640px) 33vw, 50vw" className="object-cover" />
                    ) : (
                      <UtensilsCrossed className="absolute inset-0 m-auto h-8 w-8 text-slate-300" />
                    )}
                    {left !== null && left <= 5 && (
                      <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-bold ${soldOut ? "bg-red-600 text-white" : "bg-amber-400 text-amber-950"}`}>
                        {soldOut ? "Sold out" : `Only ${left} left`}
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="flex items-start gap-1.5 text-sm font-semibold leading-snug text-slate-900">
                      <FoodTypeMark type={product.food_type} className="mt-0.5 h-3.5 w-3.5" />
                      {product.name}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-bold text-slate-900">{formatINR(product.price)}</span>
                      <button
                        onClick={() => (product.groups.length > 0 ? setCustomising(product) : addToCart(product, [], 1))}
                        disabled={soldOut}
                        className="flex items-center gap-1 rounded-xl bg-accent-500 px-3 py-1.5 text-sm font-bold text-white hover:bg-accent-600 disabled:opacity-40"
                      >
                        <Plus className="h-4 w-4" /> Add
                      </button>
                    </div>
                    {inCart(product.id) > 0 && (
                      <p className="mt-1 text-xs font-semibold text-accent-600">{inCart(product.id)} in cart</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Desktop: cart beside the menu. Phone: a bar at the bottom that opens the cart. */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 h-[calc(100vh-7rem)] overflow-hidden rounded-3xl border border-slate-200 bg-white">
          {cartPanel}
        </div>
      </aside>

      {cart.length > 0 && !showCart && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed inset-x-4 bottom-4 z-30 flex items-center justify-between rounded-2xl bg-accent-500 px-5 py-4 font-bold text-white shadow-xl lg:hidden"
        >
          <span>{itemCount} item{itemCount === 1 ? "" : "s"} · {formatINR(total)}</span>
          <span>View cart →</span>
        </button>
      )}
      {showCart && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={() => setShowCart(false)}>
          <div className="absolute inset-x-0 bottom-0 h-[85vh] overflow-hidden rounded-t-3xl bg-white" onClick={(e) => e.stopPropagation()}>
            {cartPanel}
          </div>
        </div>
      )}

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
    </div>
  );
}
