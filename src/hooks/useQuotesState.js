// 🚀 GULDKANT QUANTUM PERFORMANCE FIX - Paginerad datahämtning
// Filnamn: src/hooks/useQuotesState.js
// Final MVP Fix - implementerar paginering för att förbättra prestanda

import { useState, useCallback } from 'react';
import apiService from '../services/apiService';
import { calculateTotal } from '../utils/helpers';

const useQuotesState = (showToast) => {
    // Befintliga state-variabler
    const [quotes, setQuotes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [fetchError, setFetchError] = useState(null);

    // ✅ NYA STATE-VARIABLER FÖR PAGINERING
    const [lastRecordId, setLastRecordId] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);

    const mapStatusForAirtable = (frontendStatus) => {
        const statusMapping = {
            'godkänd': 'Accepterad',
            'förslag-skickat': 'Förslag Skickat',
            'förlorad-affär': 'Förlorad Affär',
            'genomförd': 'Genomförd',
            'betald': 'Betald',
            'utkast': 'utkast'
        };
        return statusMapping[frontendStatus] || frontendStatus;
    };

    // ✅ MODIFIERAD loadQuotes - ENDAST FÖRSTA HÄMTNINGEN
    const loadQuotes = useCallback(async () => {
        setIsLoading(true);
        setFetchError(null);
        try {
            // Anropa API:et med en limit på 12 (som första sida).
            const { records, lastId } = await apiService.fetchQuotes(12);
            setQuotes(records);
            setLastRecordId(lastId);
            setHasMore(records.length === 12);
        } catch (error) {
            console.error("🚨 Kunde inte hämta ärenden:", error);
            setFetchError(error.message);
            setQuotes([]);
            setHasMore(false);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // ✅ NY FUNKTION - LADDAR NÄSTA SIDA AV OFFERTER
    const loadMoreQuotes = useCallback(async () => {
        if (!hasMore || isFetchingMore) return;
        
        setIsFetchingMore(true);
        try {
            // Anropet skickar med ID från den sista recorden för att få nästa block.
            const { records, lastId } = await apiService.fetchQuotes(12, lastRecordId);
            setQuotes(prev => [...prev, ...records]);
            setLastRecordId(lastId);
            setHasMore(records.length === 12);
        } catch (error) {
            console.error("🚨 Kunde inte ladda fler ärenden:", error);
            showToast("Kunde inte ladda fler ärenden.", "error");
        } finally {
            setIsFetchingMore(false);
        }
    }, [hasMore, isFetchingMore, lastRecordId, showToast]);

    const saveQuote = useCallback(async (quoteData) => {
        setIsSyncing(true);
        const isNewQuote = !quoteData.id; // Identifiera om det är ett helt nytt ärende

        const withTotal = {
            ...quoteData,
            total: calculateTotal(quoteData),
            lastUpdated: new Date().toISOString()
        };

        if (withTotal.status) {
            withTotal.status = mapStatusForAirtable(withTotal.status);
        }

        const originalQuotes = [...quotes];
        const tempId = `temp-${Date.now()}`;
        if (isNewQuote) {
            withTotal.id = tempId;
        }

        // Optimistisk uppdatering: Lägg till/uppdatera direkt i UI
        setQuotes(prev => {
            if (isNewQuote) {
                // Lägg till nya offerter i början för att synas direkt
                return [withTotal, ...prev];
            }
            return prev.map(q => q.id === withTotal.id ? withTotal : q);
        });

        try {
            const result = await apiService.saveQuote(quoteData); // Skicka originaldata utan tempId

            // ⭐ MODAL-FIX: Uppdatera listan smart istället för att ladda om allt.
            if (isNewQuote) {
                // När vi skapat ett nytt ärende, ersätt det temporära med det riktiga från servern.
                setQuotes(prev => prev.map(q => q.id === tempId ? result : q));
                showToast("Ärende skapat!", "success");
            } else {
                // När vi uppdaterar ett befintligt, ersätt det med den uppdaterade versionen.
                setQuotes(prev => prev.map(q => q.id === result.id ? result : q));
                showToast("Ändringar sparade!", "success");
            }

            return result;

        } catch (error) {
            console.error("🚨 Kunde inte spara ändringar:", error);
            showToast(`Kunde inte spara: ${error.message}`, "error");
            setQuotes(originalQuotes); // Återställ vid fel
            throw error;
        } finally {
            setIsSyncing(false);
        }
    }, [quotes, showToast]);

    const addNewQuote = useCallback(async () => {
        try {
            return await saveQuote({
                status: 'utkast',
                kundNamn: 'Nytt ärende',
                kontaktPerson: '',
                email: '',
                telefon: '',
                projektTyp: '',
                eventDatum: new Date().toISOString().split('T')[0],
                guestCount: 0,
                eventTid: '',
                menuPreference: '',
                eventPlats: '',
                otherRequests: '',
                dietaryNeeds: '',
                totalPris: 0
            });
        } catch (error) {
            // Felhantering sker redan i saveQuote, behöver inte visa toast igen.
            return null;
        }
    }, [saveQuote]);

    const copyAndSaveQuote = useCallback(async (quoteToCopy) => {
        try {
            const newQuoteData = JSON.parse(JSON.stringify(quoteToCopy));

            delete newQuoteData.id;
            delete newQuoteData.rawId;
            delete newQuoteData.total;
            delete newQuoteData.totalPris;
            delete newQuoteData.lastUpdated;
            delete newQuoteData.skapad;

            newQuoteData.status = 'utkast';
            newQuoteData.eventDatum = new Date().toISOString().split('T')[0];

            return await saveQuote(newQuoteData);

        } catch (error) {
            return null;
        }
    }, [saveQuote]);

    const changeQuoteStatus = useCallback(async (quoteToUpdate, newStatus) => {
        try {
            await saveQuote({ ...quoteToUpdate, status: newStatus });
        } catch (error) {
            // Tomt, saveQuote hanterar fel
        }
    }, [saveQuote]);

    const sendProposal = useCallback(async (quote) => {
        setIsSyncing(true);
        try {
            await apiService.sendProposal(quote);
            setQuotes(prev => prev.map(q => 
                q.id === quote.id ? { ...q, status: 'Förslag Skickat' } : q
            ));
            showToast("Offert har skickats till kund!", "success");
        } catch (error) {
            showToast(`Kunde inte skicka offert: ${error.message}`, "error");
        } finally {
            setIsSyncing(false);
        }
    }, [showToast]);

    const approveProposal = useCallback((quote) => {
        changeQuoteStatus(quote, 'godkänd');
    }, [changeQuoteStatus]);

    const deleteQuote = useCallback(async (quoteId) => {
        setIsSyncing(true);
        const originalQuotes = [...quotes];
        setQuotes(prev => prev.filter(q => q.id !== quoteId));
        try {
            await apiService.deleteQuote(quoteId);
            showToast(`Ärende ${quoteId} har arkiverats.`, "success");
        } catch (error) {
            console.error("🚨 Kunde inte arkivera ärende:", error);
            showToast(`Kunde inte arkivera: ${error.message}`, "error");
            setQuotes(originalQuotes);
        } finally {
            setIsSyncing(false);
        }
    }, [quotes, showToast]);

    return {
        quotes,
        isLoading,
        isSyncing,
        fetchError,
        // ✅ EXPONERAR PAGINERINGSTATE OCH FUNKTION
        hasMore,
        isFetchingMore,
        loadQuotes,
        loadMoreQuotes,
        saveQuote,
        addNewQuote,
        copyAndSaveQuote,
        changeQuoteStatus,
        sendProposal,
        approveProposal,
        deleteQuote
    };
};

export default useQuotesState;