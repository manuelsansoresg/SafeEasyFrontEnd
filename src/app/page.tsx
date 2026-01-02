import { CategorySidebar } from "@/components/CategorySidebar";
import { ProductCard } from "@/components/ProductCard";

// Dummy Data
const products = [
  { id: "1", title: "Auriculares Inalámbricos Bluetooth 5.0 Cancelación de Ruido", price: 25.99, image: "/p1.jpg" },
  { id: "2", title: "Smartwatch Deportivo Resistente al Agua IP68", price: 45.50, image: "/p2.jpg" },
  { id: "3", title: "Funda para iPhone 13 Pro Max Silicona", price: 5.99, image: "/p3.jpg", minOrder: "10 piezas" },
  { id: "4", title: "Cargador Rápido USB-C 20W Original", price: 12.00, image: "/p4.jpg" },
  { id: "5", title: "Soporte para Celular Coche Magnético", price: 8.50, image: "/p5.jpg" },
  { id: "6", title: "Cable HDMI 4K Ultra HD 2 Metros", price: 7.99, image: "/p6.jpg" },
  { id: "7", title: "Teclado Mecánico RGB Gaming Switch Blue", price: 55.00, image: "/p7.jpg" },
  { id: "8", title: "Mouse Inalámbrico Ergonómico Vertical", price: 18.25, image: "/p8.jpg" },
  { id: "9", title: "Lámpara LED de Escritorio con Cargador Inalámbrico", price: 32.00, image: "/p9.jpg" },
  { id: "10", title: "Mochila Antirrobo Impermeable con Puerto USB", price: 29.99, image: "/p10.jpg" },
];

export default function Home() {
  const userName = "Usuario Demo"; // Demo user

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Welcome Section */}
      <div className="mb-6 bg-gradient-to-r from-orange-100 to-white p-6 rounded-2xl border border-orange-200">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
          ¡Hola, <span className="text-primary">{userName}</span>!
        </h1>
        <p className="text-muted-foreground mt-1">
          Bienvenido a SafeEasy. Encuentra los mejores productos para tu negocio.
        </p>
      </div>

      <div className="flex gap-6 relative">
        {/* Sidebar - Desktop Only */}
        <CategorySidebar />

        {/* Main Content - Product Grid */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Recomendado para ti</h2>
            <button className="text-primary text-sm font-medium hover:underline">Ver todo</button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                title={product.title}
                price={product.price}
                image={product.image}
                minOrder={product.minOrder}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
