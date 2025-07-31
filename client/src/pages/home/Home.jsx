import { useState } from "react";
import { CategorySlider, Hero, ProductList, TopSeller, Process, Trust, TopCollection } from "../../routes";

export const Home = () => {
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const handleSearch = (query) => {
        setSearchQuery(query);
        // Clear category when searching
        if (query) {
            setSelectedCategory(null);
        }
    };

    const handleCategorySelect = (category) => {
        setSelectedCategory(category);
        // Clear search when selecting category
        if (category) {
            setSearchQuery('');
        }
    };

    return (
    <>
        <Hero onSearch={handleSearch} />
        <CategorySlider onCategorySelect={handleCategorySelect}/>
        <ProductList selectedCategory={selectedCategory} searchQuery={searchQuery} />
        {/* <TopSeller/> */}
        {/* <Process/> */}
        {/* <Trust/> */}
        {/* <TopCollection/> */}
    </>
    );
};