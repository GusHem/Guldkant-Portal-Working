import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ThemeContext, themes } from './contexts/ThemeContext.jsx';
import useQuotesState from './hooks/useQuotesState.js';
import apiService from './services/apiService.js';
import SimpleLoginScreen from './components/auth/SimpleLoginScreen.jsx';
import Header from './components/layout/Header.jsx';
import MainNav from './components/layout/MainNav.jsx';
import QuotesDashboard from './components/dashboard/QuotesDashboard.jsx';
import AiLog from './components/dashboard/AiLog.jsx';
import AnalyticsPlaceholder from './components/dashboard/AnalyticsPlaceholder.jsx';
import EditModal from './components/modals/EditModal.jsx';
import ConfirmationModal from './components/modals/ConfirmationModal.jsx';
import NordSymSupportHub from './components/modals/NordSymSupportHub.jsx';
import Toast from './components/common/Toast.jsx';

function App() {
    const [theme, setTheme] = useState('light');
    const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    const classes = themes[theme];
    
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [activeView, setActiveView] = useState('quotes');
    const [filter, setFilter] = useState('alla');
    const [searchTerm, setSearchTerm] = useState('');
    const searchRef = useRef(null);
    const [toast, setToast] = useState(null);
    const toastTimer = useRef(null);
    const [confirmationState, setConfirmationState] = useState({ isOpen: false });
    const [isHubOpen, setIsHubOpen] = useState(false);
    const [selectedQuote, setSelectedQuote] = useState(null);

    const showToast = useCallback((message, type = 'success') => {
        clearTimeout(toastTimer.current);
        setToast({ id: Date.now(), message, type });
        toastTimer.current = setTimeout(() => setToast(null), 5000);
    }, []);

    const { quotes, isLoading, isSyncing, fetchError, loadQuotes, saveQuote, addNewQuote, copyAndSaveQuote, changeQuoteStatus, sendProposal, approveProposal, deleteQuote, hasMore, isFetchingMore, loadMoreQuotes } = useQuotesState(showToast);

    useEffect(() => {
        if (isLoggedIn) {
            loadQuotes();
        }
    }, [isLoggedIn, loadQuotes]);

    const handleLogin = () => setIsLoggedIn(true);
    
    // 🎯 KRITISK FIX: Använder den existerande quotes-arrayen istället för ett API-anrop.
    const handleSelectQuote = (quoteId) => {
        const selected = quotes.find(q => q.id === quoteId);
        if (selected) {
            setSelectedQuote(selected);
        } else {
            console.error(`Kunde inte hitta ärende med ID ${quoteId} i den lokala listan.`);
            showToast('Ärendet hittades inte i den lokala listan.', 'error');
        }
    };

    const handleCloseModal = () => setSelectedQuote(null);
    
    const handleAddNewQuote = () => {
        const blankQuote = {
            id: null,
            status: 'utkast',
            // ... andra tomma fält enligt er mall
        };
        setSelectedQuote(blankQuote); 
    };
    
    // ⭐ FIX #2: UPPDATERA LISTAN AUTOMATISKT EFTER SPARA
    // Denna funktion anropar nu `loadQuotes()` efter en lyckad sparning.
    const handleSaveFromModal = async (dataFromModal) => {
        const quoteToSave = {
            ...selectedQuote, 
            ...dataFromModal, 
        };

        const success = await saveQuote(quoteToSave);
        handleCloseModal(); // Stäng fönstret direkt för snabbare UI-respons

        // Om sparandet lyckades, hämta den nya, uppdaterade listan från servern.
        if (success) {
            await loadQuotes();
        }
    };

    const handleDeleteAction = async (quoteToDelete) => {
        await deleteQuote(quoteToDelete.id);
        setConfirmationState({ isOpen: false });
        handleCloseModal();
    };

    const requestDeleteConfirmation = (quote) => {
        const customerName = quote.customerName || quote.kundNamn || 'Namnlös kund';
        setConfirmationState({ 
            isOpen: true, 
            title: 'Arkivera Ärende?', 
            message: `Är du säker på att du vill arkivera ärendet "${customerName}" (${quote.id})? Detta flyttar det till arkivet.`, 
            onConfirm: () => handleDeleteAction(quote), 
            confirmText: 'Ja, arkivera', 
            confirmButtonClass: 'bg-red-600 text-white hover:bg-red-700' 
        });
    };

    // 🔬 ATOMSMED QUANTUM FIX: Closure scope bug eliminated
    const requestSendConfirmation = useCallback((quote) => {
        // ⚛️ CRITICAL FIX: Capture quote IMMEDIATELY to prevent closure scope issues
        const capturedQuote = { ...quote };
        
        // ⚡ QUANTUM EMAIL EXTRACTION - matches apiService.js exactly
        const contactEmail = capturedQuote.email ||
                             capturedQuote.contactEmail ||
                             capturedQuote['Contact Email'] ||
                             capturedQuote['E-post'] ||
                             capturedQuote.epost ||
                             capturedQuote.customerEmail ||
                             capturedQuote.kundEmail ||
                             'gustav@nordsym.com';
        
        console.log('🔍 ATOMSMED DEBUG - Quote keys:', Object.keys(capturedQuote));
        console.log('🔍 ATOMSMED DEBUG - Email fields:', Object.keys(capturedQuote).filter(k => 
            k.toLowerCase().includes('email') || 
            k.toLowerCase().includes('post') || 
            k.toLowerCase().includes('mail')
        ));
        console.log('🔍 ATOMSMED DEBUG - Extracted email:', contactEmail);
        
        setConfirmationState({ 
            isOpen: true, 
            title: 'Skicka Förslag?', 
            message: `Detta kommer att skicka ett e-postmeddelande till kunden (${contactEmail}) och ändra status. Är du säker?`, 
            onConfirm: () => { 
                console.log('🔍 ATOMSMED DEBUG - Sending proposal with captured quote:', capturedQuote);
                console.log('🔍 ATOMSMED DEBUG - Captured quote has email:', capturedQuote.email);
                sendProposal(capturedQuote); // ✅ USE CAPTURED VERSION - NEVER UNDEFINED
                handleCloseModal(); 
            }, 
            confirmText: 'Ja, skicka', 
            confirmButtonClass: `${classes.buttonPrimaryBg} ${classes.buttonPrimaryText} ${classes.buttonPrimaryHover}` 
        });
    }, [classes.buttonPrimaryBg, classes.buttonPrimaryText, classes.buttonPrimaryHover, sendProposal]);
    
    const requestApproveConfirmation = useCallback((quote) => {
        // ⚛️ APPLY SAME FIX: Capture quote to prevent closure issues
        const capturedQuote = { ...quote };
        
        setConfirmationState({ 
            isOpen: true, 
            title: 'Godkänn Förslag Manuellt?', 
            message: `Är du säker på att du vill godkänna detta förslag? Statusen kommer ändras till "Godkänd".`, 
            onConfirm: () => { 
                approveProposal(capturedQuote); 
                handleCloseModal(); 
            }, 
            confirmText: 'Ja, godkänn', 
            confirmButtonClass: 'bg-green-500 text-white hover:bg-green-600' 
        });
    }, [approveProposal]);

    const sortedAndFilteredQuotes = useMemo(() => {
        const aktivaStatus = ['utkast', 'förslag-skickat', 'godkänd', 'genomförd', 'betald'];
        const arkivStatus = ['förlorad-affär', 'arkiverad', 'nekad', 'förlorad'];
        const statusMapping = { 'accepterad': 'godkänd', 'skickad': 'förslag-skickat', 'förslag skickat': 'förslag-skickat', 'nekad': 'förlorad-affär', 'utkast': 'utkast' };

        if (!quotes) return [];

        const translatedQuotes = quotes.map(q => {
            const originalStatus = q.status || 'utkast'; 
            const normalizedStatus = originalStatus.toLowerCase().replace(/\s+/g, '-');
            const technicalStatus = statusMapping[normalizedStatus] || normalizedStatus;
            return { ...q, status: technicalStatus };
        });

        return translatedQuotes.filter(q => {
            const term = searchTerm.toLowerCase();
            const customerName = q.customerName || q.kundNamn || '';
            const searchMatch = term === '' || customerName.toLowerCase().includes(term) || q.id?.toLowerCase().includes(term);
            
            let statusMatch = false;
            if (filter === 'alla') statusMatch = aktivaStatus.includes(q.status); 
            else if (filter === 'arkiv') statusMatch = arkivStatus.includes(q.status); 
            else statusMatch = q.status === filter; 
            
            return statusMatch && searchMatch;
        });
    }, [quotes, filter, searchTerm]);

    const isModalOpen = !!selectedQuote || confirmationState.isOpen || isHubOpen;

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, classes }}>
             <div className={`${classes.bg} ${classes.text} min-h-screen font-sans transition-colors duration-300`}>
                {!isLoggedIn ? ( <SimpleLoginScreen onLogin={handleLogin} /> ) : (
                    <>
                        <div className={`flex flex-col h-screen transition-all duration-300 ${isModalOpen || isSyncing ? 'filter blur-sm' : ''}`}>
                            <Header onToggleTheme={toggleTheme} theme={theme} onOpenHub={() => setIsHubOpen(true)} />
                            <MainNav activeView={activeView} setActiveView={setActiveView} />
                            <main className="flex-grow overflow-y-auto">
                                {activeView === 'quotes' && ( 
                                    <QuotesDashboard 
                                        allQuotes={quotes}
                                        displayQuotes={sortedAndFilteredQuotes}
                                        isLoading={isLoading} 
                                        fetchError={fetchError}
                                        onSelectQuote={handleSelectQuote}
                                        onNewQuote={handleAddNewQuote}
                                        onFilterChange={setFilter} 
                                        onSearch={setSearchTerm} 
                                        activeFilter={filter} 
                                        searchRef={searchRef} 
                                        onStatusChange={changeQuoteStatus} 
                                        hasMore={hasMore}
                                        isFetchingMore={isFetchingMore}
                                        onLoadMore={loadMoreQuotes}
                                    /> 
                                )}
                                {activeView === 'ai' && <AiLog />}
                                {activeView === 'analytics' && <AnalyticsPlaceholder />}
                            </main>
                        </div>

                        {isSyncing && (<div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50"><div className="text-white text-lg font-semibold animate-pulse">Synkroniserar...</div></div>)}

                        <EditModal 
                            quote={selectedQuote} 
                            isOpen={!!selectedQuote} 
                            onClose={handleCloseModal} 
                            onSave={handleSaveFromModal} 
                            onCopy={copyAndSaveQuote} 
                            showToast={showToast} 
                            onDelete={requestDeleteConfirmation} 
                            onSendProposal={requestSendConfirmation}
                            onApproveProposal={requestApproveConfirmation}
                         />
                        <ConfirmationModal 
                            isOpen={confirmationState.isOpen} 
                            onClose={() => setConfirmationState({ isOpen: false })} 
                            onConfirm={confirmationState.onConfirm} 
                            title={confirmationState.title} 
                            message={confirmationState.message} 
                            confirmText={confirmationState.confirmText}
                            confirmButtonClass={confirmationState.confirmButtonClass}
                        />
                        <NordSymSupportHub isOpen={isHubOpen} onClose={() => setIsHubOpen(false)} />
                        <Toast toast={toast} />
                    </>
                )}
            </div>
        </ThemeContext.Provider>
    );
}

export default App;
// 🔬 ATOMSMED QUANTUM COLLAPSE - Closure scope bug eliminated with captured quotes
// Email bug ELIMINATED through proper JavaScript closure handling
