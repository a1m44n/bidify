import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Container, Title, Body } from '../../components/common/Design';
import { ProductCard } from '../../components/cards/ProductCard';
import api from '../../utils/api';

const SearchResults = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({
        page: 1,
        totalPages: 1,
        total: 0
    });

    // Get search parameters from URL
    const searchParams = new URLSearchParams(location.search);
    const query = searchParams.get('query') || '';
    const page = parseInt(searchParams.get('page')) || 1;

    useEffect(() => {
        const fetchResults = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const queryParams = new URLSearchParams();
                if (query.trim()) {
                    queryParams.append('query', query.trim());
                }
                queryParams.append('page', page);
                queryParams.append('limit', 20);

                const url = `/product/search?${queryParams}`;
                const response = await api.get(url);

                if (response.data.success) {
                    setResults(response.data.products || []);
                    setPagination({
                        page: response.data.page || 1,
                        totalPages: response.data.totalPages || 1,
                        total: response.data.total || 0
                    });
                } else {
                    setError(response.data.message || 'Search failed');
                }
            } catch (err) {
                console.error('Search error:', err);
                let errorMessage = 'Failed to fetch search results. Please try again.';
                
                if (err.response?.status === 500) {
                    errorMessage = `Server error: ${err.response?.data?.message || 'Internal server error'}`;
                } else if (err.response?.status === 404) {
                    errorMessage = 'Search endpoint not found.';
                } else if (err.response?.data?.message) {
                    errorMessage = err.response.data.message;
                }
                
                setError(errorMessage);
            } finally {
                setIsLoading(false);
            }
        };

        fetchResults();
    }, [query, page]);

    // Handle page change
    const handlePageChange = (newPage) => {
        const newSearchParams = new URLSearchParams();
        if (query.trim()) {
            newSearchParams.append('query', query.trim());
        }
        newSearchParams.append('page', newPage);
        navigate(`/search?${newSearchParams.toString()}`);
    };

    // Handle new search
    const handleSearch = (e) => {
        e.preventDefault();
        const searchInput = e.target.elements.searchQuery;
        if (searchInput && searchInput.value.trim()) {
            const newSearchParams = new URLSearchParams();
            newSearchParams.append('query', searchInput.value.trim());
            navigate(`/search?${newSearchParams.toString()}`);
        }
    };

    return (
        <Container className="py-8">
            {/* Search Header */}
            <div className="mb-8">
                <Title level={2}>
                    Search Results
                    {query && <span className="text-gray-600 text-lg ml-2">for "{query}"</span>}
                </Title>
                {pagination.total > 0 && (
                    <Body className="text-gray-600">
                        Found {pagination.total} items
                    </Body>
                )}
            </div>

            {/* Search Bar */}
            <div className="mb-8">
                <form onSubmit={handleSearch} className="flex gap-4">
                    <input
                        type="text"
                        name="searchQuery"
                        defaultValue={query}
                        placeholder="Search products..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                        type="submit"
                        className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                    >
                        Search
                    </button>
                </form>
            </div>

            {/* Results */}
            {isLoading ? (
                <div className="flex justify-center items-center min-h-[400px]">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                </div>
            ) : error ? (
                <div className="text-center text-red-600 py-8">
                    <div className="text-lg font-semibold mb-2">Search Error</div>
                    <div>{error}</div>
                </div>
            ) : results.length === 0 ? (
                <div className="text-center py-8">
                    <Title level={3} className="text-gray-600">
                        {query ? 'No results found' : 'Enter a search term to find products'}
                    </Title>
                    {query && <Body className="mt-2">Try a different search term</Body>}
                </div>
            ) : (
                <>
                    {/* Products Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {results.map((product) => (
                            <ProductCard
                                key={product._id}
                                item={product}
                                showTimeLeft={true}
                            />
                        ))}
                    </div>

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="flex justify-center items-center mt-8 gap-4">
                            <button
                                onClick={() => handlePageChange(pagination.page - 1)}
                                disabled={pagination.page === 1}
                                className={`px-4 py-2 rounded ${
                                    pagination.page === 1
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-primary text-white hover:bg-primary-dark'
                                }`}
                            >
                                Previous
                            </button>
                            
                            <span className="text-gray-600">
                                Page {pagination.page} of {pagination.totalPages}
                            </span>
                            
                            <button
                                onClick={() => handlePageChange(pagination.page + 1)}
                                disabled={pagination.page === pagination.totalPages}
                                className={`px-4 py-2 rounded ${
                                    pagination.page === pagination.totalPages
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-primary text-white hover:bg-primary-dark'
                                }`}
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}
        </Container>
    );
};

export default SearchResults; 