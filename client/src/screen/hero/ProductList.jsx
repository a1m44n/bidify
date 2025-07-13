import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { ProductCard } from "../../components/cards/ProductCard";
import { Container, Heading } from "../../components/common/Design";
import API_URL from '../../config/api';

// Helper function to normalize category names
const normalizeCategory = (category) => {
    if (!category) return '';
    return category
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/\s+/g, ' ')
        .trim();
};

export const ProductList = ({ selectedCategory, searchQuery }) => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const pollingIntervalRef = useRef(null);

    const fetchProducts = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/product`);
            setProducts(response.data);
            setLoading(false);
        } catch (err) {
            setError('Failed to fetch products');
            setLoading(false);
        }
    };

    // Initial fetch
    useEffect(() => {
        fetchProducts();
    }, []);

    // Set up polling for real-time updates
    useEffect(() => {
        // Set up polling every 3 seconds
        pollingIntervalRef.current = setInterval(fetchProducts, 3000);
        
        // Clean up interval on component unmount
        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
    }, []);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>{error}</div>;

    // Filter products based on selected category and search query
    let filteredProducts = products;
    
    // Apply category filter
    if (selectedCategory) {
        filteredProducts = filteredProducts.filter(product => 
            normalizeCategory(product.category) === normalizeCategory(selectedCategory)
        );
    }
    
    // Apply search filter
    if (searchQuery && searchQuery.trim()) {
        const searchTerm = searchQuery.trim().toLowerCase();
        filteredProducts = filteredProducts.filter(product => 
            product.title?.toLowerCase().includes(searchTerm) ||
            product.description?.toLowerCase().includes(searchTerm)
        );
    }

    return (
        <>
            <section className="product-home" id="search-results">
                <Container>
                    <Heading 
                        title={
                            searchQuery ? `Search Results for "${searchQuery}"` :
                            selectedCategory ? `${selectedCategory} Auctions` : 
                            "Live Auctions"
                        } 
                        subtitle={
                            searchQuery ? `Found ${filteredProducts.length} results` :
                            "Explore our latest auctions"
                        }
                    /> 
                    {filteredProducts.length === 0 && searchQuery ? (
                        <div className="text-center py-12">
                            <h3 className="text-xl text-gray-600 mb-4">No products found for "{searchQuery}"</h3>
                            <p className="text-gray-500">Try a different search term or browse all products</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 my-8">
                            {filteredProducts.map((item) => (
                                <ProductCard item={item} key={item._id}/>
                            ))}
                        </div>
                    )}
                </Container>
            </section>
        </>
    );
};