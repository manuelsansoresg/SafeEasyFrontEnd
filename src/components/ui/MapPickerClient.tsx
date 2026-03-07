"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Search } from "lucide-react";
import L from "leaflet";

// Fix Leaflet icon issues
const fixLeafletIcon = () => {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  });
};

export interface AddressDetails {
  street?: string;
  exteriorNumber?: string;
  neighborhood?: string;
  postalCode?: string;
  city?: string;
  state?: string;
  country?: string;
}

interface MapPickerClientProps {
  location?: { lat: number; lng: number } | null;
  onChange?: (location: { lat: number; lng: number }) => void;
  readOnly?: boolean;
  height?: string;
  zoom?: number;
  addressContext?: AddressDetails;
  className?: string;
}

function LocationMarker({
  location,
  onChange,
  readOnly,
}: {
  location: { lat: number; lng: number } | null;
  onChange?: (location: { lat: number; lng: number }) => void;
  readOnly?: boolean;
}) {
  const map = useMap();
  const markerRef = useRef<any>(null);

  useMapEvents({
    click(e) {
      if (!readOnly && onChange) {
        onChange(e.latlng);
        // map.flyTo(e.latlng, map.getZoom()); // Optional: don't fly on click if it's annoying
      }
    },
  });

  useEffect(() => {
    if (location) {
      map.flyTo(location, map.getZoom());
    }
  }, [location, map]);

  const eventHandlers = useMemo(
    () => ({
      click() {
        if (readOnly && location) {
          window.open(`https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`, '_blank');
        }
      },
      dragend() {
        const marker = markerRef.current;
        if (marker != null && onChange) {
          onChange(marker.getLatLng());
        }
      },
    }),
    [onChange, readOnly, location]
  );

  return location === null ? null : (
    <Marker 
      draggable={!readOnly}
      eventHandlers={eventHandlers}
      position={location}
      ref={markerRef}
    >
      <Popup>Ubicación seleccionada</Popup>
    </Marker>
  );
}

function SearchControl({ onSelect, addressContext }: { onSelect: (lat: number, lng: number) => void, addressContext?: AddressDetails }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSelectingRef = useRef<boolean>(false);
  const requestIdRef = useRef<number>(0);
  const map = useMap();

  useEffect(() => {
    // Disable map click propagation when clicking on search
    if (searchRef.current) {
        L.DomEvent.disableClickPropagation(searchRef.current);
        L.DomEvent.disableScrollPropagation(searchRef.current);
    }
  }, []);
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (isSelectingRef.current) return; // evitar reabrir lista justo después de seleccionar
      if (query.trim().length > 3) {
        handleSearch();
      } else if (query.trim().length === 0) {
        setResults([]);
      }
    }, 800);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const constructQueryFromDetails = (details: AddressDetails) => {
    const parts = [];
    
    let streetPart = details.street || "";
    // Heuristic: Add "Calle" if it looks like a numbered street or short name and doesn't have a prefix
    // Only if it doesn't already start with common street prefixes
    if (streetPart && !/^(calle|av|avenida|blvd|boulevard|cerrada|privada|calzada|andador|retorno)/i.test(streetPart)) {
         streetPart = `Calle ${streetPart}`;
    }
    
    if (streetPart) {
        parts.push(`${streetPart} ${details.exteriorNumber || ''}`.trim());
    }
    
    if (details.neighborhood) parts.push(details.neighborhood);
    if (details.postalCode) parts.push(details.postalCode);
    if (details.city) parts.push(details.city);
    if (details.state) parts.push(details.state);
    if (details.country) parts.push(details.country);
    
    return parts.join(", ");
  };

  // Helper to patch display names with correct CP, Exterior Number, and Neighborhood if mismatched/missing
  const patchDisplayNames = (results: any[], targetPostalCode?: string | null, targetExteriorNumber?: string | null, targetNeighborhood?: string | null) => {
      if (results.length === 0) return results;
      
      return results.map(result => {
           let newDisplayName = result.display_name;
           const addr = result.address || {};
           
           // Patch Postal Code
           if (targetPostalCode) {
               const p1 = targetPostalCode.replace(/\s/g, '');
               const p2 = (addr.postcode || '').replace(/\s/g, '');
               if (p2 && p1 !== p2 && newDisplayName.includes(p2)) {
                   console.log(`Patching CP in display name: ${p2} -> ${p1}`);
                   newDisplayName = newDisplayName.replace(p2, p1);
                   addr.postcode = p1;
               }
           }

           // Patch Exterior Number (if missing)
           if (targetExteriorNumber) {
               // Check if number is already in display name
               if (!newDisplayName.includes(targetExteriorNumber)) {
                   // Try to insert after street name
                   const road = addr.road || addr.pedestrian || addr.footway || addr.path;
                   if (road && newDisplayName.includes(road)) {
                       // Replace "StreetName," with "StreetName Number,"
                       // Handle comma if present
                       const roadPattern = new RegExp(road.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + "([,]?)");
                       newDisplayName = newDisplayName.replace(roadPattern, `${road} ${targetExteriorNumber}$1`);
                   } 
               }
           }

           // Patch Neighborhood (if missing)
           if (targetNeighborhood) {
               // Check if neighborhood is already in display name (case insensitive)
               if (!newDisplayName.toLowerCase().includes(targetNeighborhood.toLowerCase())) {
                   // Try to insert before City, Postcode, or State
                   const city = addr.city || addr.town || addr.village || addr.municipality;
                   const state = addr.state;
                   const postcode = addr.postcode; // This might be the patched one now
                   
                   let inserted = false;
                   
                   // Priority 1: Insert before City
                   if (city && newDisplayName.includes(city)) {
                        // Avoid double comma
                        const pattern = new RegExp(`(,?\\s*)${city.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}`);
                        newDisplayName = newDisplayName.replace(pattern, `, ${targetNeighborhood}, ${city}`);
                        inserted = true;
                   } 
                   // Priority 2: Insert before Postcode
                   else if (postcode && newDisplayName.includes(postcode)) {
                        const pattern = new RegExp(`(,?\\s*)${postcode.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}`);
                        newDisplayName = newDisplayName.replace(pattern, `, ${targetNeighborhood}, ${postcode}`);
                        inserted = true;
                   }
                   // Priority 3: Insert before State
                   else if (state && newDisplayName.includes(state)) {
                        const pattern = new RegExp(`(,?\\s*)${state.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}`);
                        newDisplayName = newDisplayName.replace(pattern, `, ${targetNeighborhood}, ${state}`);
                        inserted = true;
                   }
                   
                   if (inserted) {
                       addr.neighbourhood = targetNeighborhood;
                   }
               }
           }

           return {
               ...result,
               display_name: newDisplayName,
               address: addr
           };
      });
  };

  const handleSearch = async (overrideQuery?: string) => {
    const rid = ++requestIdRef.current;
    const q = overrideQuery || query;
    if (!q.trim()) return;
    setSearching(true);
    setResults([]);
    
    // Extract postal code from query if present (5 digits)
    const queryPostalCodeMatch = q.match(/\b\d{5}\b/);
    const queryPostalCode = queryPostalCodeMatch ? queryPostalCodeMatch[0] : null;

    // Helper to fetch
    const fetchNominatim = async (queryStr: string) => {
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
                queryStr
                )}&addressdetails=1&limit=5&countrycodes=mx`
            );
            return await res.json();
        } catch (e) {
            console.error(e);
            return [];
        }
    };

    // Helper to filter results by postal code if available
    const filterByPostalCode = (results: any[], targetPostalCode: string | null | undefined) => {
        if (!targetPostalCode || results.length === 0) return results;
        
        return results.filter((result: any) => {
             const addr = result.address || {};
             
             // Check Strict Street Match (New)
             const street = addressContext?.street;
             if (street) {
                 const normalize = (s: string) => s.toLowerCase()
                    .replace(/^(calle|av\.|avenida|blvd|boulevard|privada|cerrada|calzada|andador|retorno)\s+/g, '')
                    .replace(/[^a-z0-9]/g, '');
                 
                 const targetS = normalize(street);
                 const resultS = normalize(addr.road || addr.pedestrian || addr.footway || addr.path || '');
                 
                 if (targetS && resultS && (targetS === resultS)) {
                     return true;
                 }
             }

             if (!addr.postcode) return false; // If we're strict about postal code, missing one is a fail? Or let it pass? Let's fail for now if strictly looking for it.
             
             const p1 = targetPostalCode.replace(/\s/g, '');
             const p2 = (addr.postcode || '').replace(/\s/g, '');
             
             return p1 === p2 || p1.includes(p2) || p2.includes(p1);
        });
    };

    try {
      // 1. First try: Exact search with the full query
      let data = await fetchNominatim(q);
      
      // 1.5. Try Hyphenating Street Number in Query (e.g. "34C" -> "34-C")
      if (data.length === 0) {
          const hyphenatedQ = q.replace(/\b(\d+)([a-zA-Z])\b/g, "$1-$2");
          if (hyphenatedQ !== q) {
              console.log("Retrying with hyphenated query:", hyphenatedQ);
              let hyphenData = await fetchNominatim(hyphenatedQ);
              
              // If we found something, use it (but be careful about CP mismatch if user typed one)
              if (hyphenData.length > 0) {
                  // If original query had a CP, and we found results, we should probably check CP
                  if (queryPostalCode) {
                      const filtered = filterByPostalCode(hyphenData, queryPostalCode);
                      // If filtering removes everything, it might be the "17144 vs 97144" issue again.
                      // If the street name matches strongly, we should keep it.
                      // But here we don't have structured street name easily.
                      // Let's just trust Nominatim's result if it matches the text well enough?
                      // Actually, if user typed "97144" and result is "17144", filterByPostalCode will kill it.
                      // We need to be smarter here too.
                      
                      if (filtered.length > 0) {
                          data = filtered;
                      } else {
                          // Filter killed it. Check if street name matches "34-C" pattern
                          const streetMatch = hyphenData.some((r: any) => {
                              const name = (r.address?.road || '').toLowerCase();
                              return name.includes(hyphenatedQ.match(/calle\s*(\d+-[a-zA-Z])/i)?.[1]?.toLowerCase() || 'nevermatch');
                          });
                          if (streetMatch) data = hyphenData; 
                      }
                  } else {
                      data = hyphenData;
                  }
              }
          }
      }

      // Filter if we found a postal code in the query
      if (queryPostalCode) {
          const filtered = filterByPostalCode(data, queryPostalCode);
          if (filtered.length > 0) {
              data = filtered;
          } else {
               // If filtering removed everything, maybe we should search JUST the postal code as fallback?
               // But let's continue to standard fallbacks first.
               // Actually, if the user typed a postal code and we found results in WRONG postal codes, we should probably discard them.
               data = []; 
          }
      }

      // 2. Second try: If no results, try removing neighborhood/colonia if present
      // Fallback strategies using addressContext if available
      if (data.length === 0 && addressContext) {
         const targetPostalCode = addressContext.postalCode;

         // Construct a simpler query: Street + Number + Postal Code + City + State
         let simpleStreet = addressContext.street || "";
         // Add "Calle" prefix if missing and needed
         if (simpleStreet && !/^(calle|av|avenida|blvd|boulevard|privada|cerrada|calzada)/i.test(simpleStreet)) {
             simpleStreet = `Calle ${simpleStreet}`;
         }
         
         if (simpleStreet && addressContext.city && addressContext.state) {
             let retryQuery = `${simpleStreet} ${addressContext.exteriorNumber || ''}`;
             if (targetPostalCode) retryQuery += `, ${targetPostalCode}`;
             retryQuery += `, ${addressContext.city}, ${addressContext.state}`;

             // Avoid repeating the exact same query
             if (retryQuery.toLowerCase() !== q.toLowerCase()) {
                 console.log("Retrying with simpler query:", retryQuery);
                 let fallbackData = await fetchNominatim(retryQuery);
                 // Apply strict filtering on fallback
                 if (targetPostalCode) {
                     fallbackData = filterByPostalCode(fallbackData, targetPostalCode);
                 }
                 if (fallbackData.length > 0) data = fallbackData;
             }
         }
      }

      // 3. Third try: Street + Postal Code + City + State (without number)
       if (data.length === 0 && addressContext) {
         const targetPostalCode = addressContext.postalCode;
         let simpleStreet = addressContext.street || "";
         if (simpleStreet && !/^(calle|av|avenida|blvd|boulevard|privada|cerrada|calzada)/i.test(simpleStreet)) {
             simpleStreet = `Calle ${simpleStreet}`;
         }
         
         if (simpleStreet && addressContext.city && addressContext.state) {
             // 3a. Try standard Street + CP + City
             let retryQueryNoNum = `${simpleStreet}`;
             if (targetPostalCode) retryQueryNoNum += `, ${targetPostalCode}`;
             retryQueryNoNum += `, ${addressContext.city}, ${addressContext.state}`;

              if (retryQueryNoNum.toLowerCase() !== q.toLowerCase()) {
                 console.log("Retrying without number:", retryQueryNoNum);
                 let fallbackData = await fetchNominatim(retryQueryNoNum);
                 if (targetPostalCode) {
                     fallbackData = filterByPostalCode(fallbackData, targetPostalCode);
                 }
                 if (fallbackData.length > 0) data = fallbackData;
             }

             // 3b. Try Hyphenated Street + City + State (NO CP, NO Neighborhood)
              // This fixes "Calle 34C" -> "Calle 34-C" which is common in Merida OSM data
              // And we intentionally OMIT postal code to avoid mismatches (e.g. 17144 vs 97144)
              if (data.length === 0) {
                  const streetRaw = (addressContext.street || "").replace(/^(calle\s+|av\.\s+|avenida\s+)/i, '');
                  // Match "34C" or "34 C" or "34-C"
                  const match = streetRaw.match(/^(\d+)\s*[-]?\s*([a-zA-Z])$/);
                  
                  if (match) {
                      const variant = `${match[1]}-${match[2]}`; // Force "34-C" format
                      const hyphenQuery = `Calle ${variant}, ${addressContext.city}, ${addressContext.state}`;
                      console.log("Retrying Hyphenated Street (No CP):", hyphenQuery);
                      
                      let hyphenData = await fetchNominatim(hyphenQuery);
                      
                      // Strict Filter: Must match the street name variants
                      // We accept it even if CP is wrong
                      const filtered = hyphenData.filter((result: any) => {
                          const addr = result.address || {};
                          const resultS = (addr.road || addr.pedestrian || addr.footway || addr.path || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                          const targetS1 = `calle${match[1]}${match[2]}`; // calle34c
                          const targetS2 = `calle${match[1]}${match[2].toLowerCase()}`; 
                          
                          // Check if result contains "34c"
                          return resultS.includes(targetS1) || resultS.includes(`${match[1]}${match[2].toLowerCase()}`);
                      });
                      
                      if (filtered.length > 0) data = filtered;
                  }
              }
         }
      }
      
      // 4. Fourth try: Street + Neighborhood (Priority if CP fails)
      if (data.length === 0 && addressContext) {
           const targetNeighborhood = addressContext.neighborhood;
           const targetPostalCode = addressContext.postalCode;
           let simpleStreet = addressContext.street || "";
           
           if (simpleStreet && targetNeighborhood && addressContext.city && addressContext.state) {
               let q = `${simpleStreet} ${addressContext.exteriorNumber || ''}, ${targetNeighborhood}, ${addressContext.city}, ${addressContext.state}`;
               if (!/^(calle|av)/i.test(simpleStreet)) q = `Calle ${simpleStreet} ${addressContext.exteriorNumber || ''}, ${targetNeighborhood}, ${addressContext.city}, ${addressContext.state}`;
               
               console.log("Retrying Street + Neighborhood (Manual):", q);
               let fallbackData = await fetchNominatim(q);
               
               const filtered = fallbackData.filter((result: any) => {
                   const addr = result.address || {};
                   const resultNb = (addr.neighbourhood || addr.suburb || addr.residential || addr.hamlet || '').toLowerCase();
                   const targetNb = targetNeighborhood.toLowerCase();
                   
                   // Check Strict Street Match first
                   if (simpleStreet) {
                       const normalize = (s: string) => s.toLowerCase()
                          .replace(/^(calle|av\.|avenida|blvd|boulevard|privada|cerrada|calzada|andador|retorno)\s+/g, '')
                          .replace(/[^a-z0-9]/g, '');
                       
                       const targetS = normalize(simpleStreet);
                       const resultS = normalize(addr.road || addr.pedestrian || addr.footway || addr.path || '');
                       
                       if (targetS && resultS && (targetS === resultS)) {
                           return true;
                       }
                   }

                   const nbMatch = resultNb.includes(targetNb) || targetNb.includes(resultNb);
                   
                   if (nbMatch) return true;
                   
                   if (targetPostalCode && addr.postcode) {
                        const p1 = targetPostalCode.replace(/\s/g, '');
                        const p2 = (addr.postcode || '').replace(/\s/g, '');
                        return p1 === p2;
                   }
                   
                   return false;
               });
               
               if (filtered.length > 0) data = filtered;
           }
      }

      // 5. Fifth try: Just Postal Code + City + State (New Strategy)
      if (data.length === 0 && addressContext?.postalCode) {
          const postalQuery = `${addressContext.postalCode}, ${addressContext.city || ''}, ${addressContext.state || ''}`;
           if (postalQuery.toLowerCase() !== q.toLowerCase()) {
               console.log("Retrying with just postal code:", postalQuery);
               let fallbackData = await fetchNominatim(postalQuery);
               // Strict check not needed here as we searched BY postal code, but good to have
               fallbackData = filterByPostalCode(fallbackData, addressContext.postalCode);
               if (fallbackData.length > 0) data = fallbackData;
           }
      }

      // 6. Sixth try: City + State + Country
      if (data.length === 0 && addressContext) {
        const cityStateQuery = `${addressContext.city || ''}, ${addressContext.state || ''}, ${addressContext.country || 'Mexico'}`.replace(/,\s*,/g, ',').trim();
        if (cityStateQuery.toLowerCase() !== q.toLowerCase() && addressContext.city) {
             console.log("No exact match found. Trying fallback:", cityStateQuery);
             data = await fetchNominatim(cityStateQuery);
        }
      }

      // 7. Seventh try: Just State + Country
      if (data.length === 0 && addressContext?.state) {
         const stateQuery = `${addressContext.state}, ${addressContext.country || 'Mexico'}`;
         if (stateQuery.toLowerCase() !== q.toLowerCase()) {
             data = await fetchNominatim(stateQuery);
         }
      }

      // Manual search: no patching with form context here; show raw results

      if (rid !== requestIdRef.current || isSelectingRef.current) return;
      setResults(data);
      if (overrideQuery) {
        setQuery(overrideQuery);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setSearching(false);
    }
  };

  const searchWithContext = async () => {
    const rid = ++requestIdRef.current;
    if (!addressContext) return;
    setSearching(true);
    setResults([]);

    // Base params for structured search
    const baseParams = {
        format: 'json',
        addressdetails: '1',
        limit: '10', // Increased limit to find correct neighborhood in list
        countrycodes: 'mx'
    };

    const fetchStructured = async (params: Record<string, string>) => {
      try {
        const searchParams = new URLSearchParams({
            ...baseParams,
            ...params
        });
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${searchParams.toString()}`);
        return await res.json();
      } catch (e) {
        console.error(e);
        return [];
      }
    };

    // Helper for free-text search (q param) which handles neighborhood better than structured
    const fetchFreeText = async (queryStr: string) => {
        try {
            const searchParams = new URLSearchParams({
                ...baseParams,
                q: queryStr
            });
            const res = await fetch(`https://nominatim.openstreetmap.org/search?${searchParams.toString()}`);
            return await res.json();
        } catch (e) {
            console.error(e);
            return [];
        }
    };

    try {
        let finalResults: any[] = [];
        const street = addressContext.street || '';
        const num = addressContext.exteriorNumber || '';
        const neighborhood = addressContext.neighborhood || '';
        const postalCode = addressContext.postalCode || '';
        const city = addressContext.city || '';
        const state = addressContext.state || '';
        const country = addressContext.country || 'Mexico';

        // Helper to check if a result matches the target neighborhood or postal code
        const isMatch = (result: any) => {
            const addr = result.address || {};
            
            // Priority 0: Strict Street Name Check (New)
            // If the street name matches the user input strongly, we accept it even if CP/Neighborhood differs.
            // This fixes issues where OSM has wrong CP (e.g. 17144 vs 97144) or missing Neighborhood.
            if (street) {
                 const normalize = (s: string) => s.toLowerCase()
                    .replace(/^(calle|av\.|avenida|blvd|boulevard|privada|cerrada|calzada|andador|retorno)\s+/g, '')
                    .replace(/[^a-z0-9]/g, '');
                 
                 const targetS = normalize(street);
                 const resultS = normalize(addr.road || addr.pedestrian || addr.footway || addr.path || '');
                 
                 // Check for exact match or strong containment
                 // e.g. "34c" matches "34c" (from Calle 34-C)
                 if (targetS && resultS && (targetS === resultS)) {
                     return true;
                 }
            }

            // Priority 1: Strict Postal Code Check
            if (postalCode && addr.postcode) {
                const p1 = postalCode.replace(/\s/g, '');
                const p2 = (addr.postcode || '').replace(/\s/g, '');
                
                // If postal codes match, it's a strong match
                if (p1 === p2 || p1.includes(p2) || p2.includes(p1)) {
                    return true;
                }
                
                // If postal code DOESN'T match, we normally reject it.
                // BUT, if the Neighborhood name matches very strongly, maybe the CP in Nominatim is wrong?
                // Let's check neighborhood before rejecting.
            }

            // Priority 2: Neighborhood Match
            if (neighborhood) {
                const resultNb = (addr.neighbourhood || addr.suburb || addr.residential || addr.hamlet || '').toLowerCase();
                const targetNb = neighborhood.toLowerCase();
                
                // Direct match or partial match
                if (resultNb.includes(targetNb) || targetNb.includes(resultNb)) {
                    return true;
                }
            }
            
            // If we have a postal code and it didn't match, AND neighborhood didn't match -> Reject
            if (postalCode && addr.postcode) {
                const p1 = postalCode.replace(/\s/g, '');
                const p2 = (addr.postcode || '').replace(/\s/g, '');
                if (p1 !== p2 && !p1.includes(p2) && !p2.includes(p1)) {
                    return false;
                }
            }
            
            // If no strict criteria failed, allow it? 
            // If neighborhood was required but not found, we should probably be strict if postal code also failed.
            if (neighborhood && !postalCode) return false;

            return true;
        };

        // Helper to filter results
        const filterResults = (results: any[]) => {
            if ((!neighborhood && !postalCode) || results.length === 0) return results;
            const matches = results.filter(isMatch);
            return matches.length > 0 ? matches : [];
        };

        // Helper to try structured search with a specific street string
        const tryStreetStructured = async (streetStr: string, usePostalCode = false) => {
            // Only try if we haven't found a good match yet
            if (finalResults.length > 0) return [];
            
            const params: any = {
                street: `${streetStr} ${num}`.trim(),
                city,
                state,
                country
            };
            if (usePostalCode && postalCode) params.postalcode = postalCode;

            let res = await fetchStructured(params);
            
            let filtered = filterResults(res);
            if (filtered.length > 0) return filtered;

            if (res.length === 0) {
                 // Try without number
                 const paramsNoNum: any = {
                    street: streetStr,
                    city,
                    state,
                    country
                };
                if (usePostalCode && postalCode) paramsNoNum.postalcode = postalCode;
                
                 res = await fetchStructured(paramsNoNum);
                filtered = filterResults(res);
                if (filtered.length > 0) return filtered;
            }
            return [];
        };

        // Strategy 0: Postal Code + Street (Strongest)
        if (postalCode && street) {
             // Free text with Postal Code often works best in Nominatim
             let q = `${street} ${num}, ${postalCode}, ${city}, ${state}`;
             if (!/^(calle|av)/i.test(street)) q = `Calle ${street} ${num}, ${postalCode}, ${city}, ${state}`;
             
             let data = await fetchFreeText(q);
             let filtered = filterResults(data);
             if (filtered.length > 0) finalResults = filtered;
             
             if (finalResults.length === 0) {
                 // Try variations with Postal Code
                 const streetRaw = street.replace(/^(calle\s+|av\.\s+|avenida\s+)/i, '');
                 
                 // Variation: "C. 34C" + CP
                 const variantC = `C. ${streetRaw}`;
                 finalResults = await tryStreetStructured(variantC, true);
                 
                 // Variation: "34-C" + CP
                 if (finalResults.length === 0) {
                     const match = streetRaw.match(/^(\d+)([a-zA-Z])$/);
                     if (match) {
                         const variant = `${match[1]}-${match[2]}`;
                         finalResults = await tryStreetStructured(`Calle ${variant}`, true);
                         
                         if (finalResults.length === 0) {
                              // "34 C"
                              const variantSpace = `${match[1]} ${match[2]}`;
                              finalResults = await tryStreetStructured(`Calle ${variantSpace}`, true);
                         }
                     }
                 }
             }
        }

        // Strategy 1: Full free-text search including Neighborhood (Specific)
        if (finalResults.length === 0 && street && neighborhood) {
             let q = `${street} ${num}, ${neighborhood}, ${city}, ${state}`;
             if (!/^(calle|av)/i.test(street)) q = `Calle ${street} ${num}, ${neighborhood}, ${city}, ${state}`;
             
             let data = await fetchFreeText(q);
             let filtered = filterResults(data);
             
             if (filtered.length > 0) {
                 finalResults = filtered;
             } else {
                 // Try variations of street name in free text if failed
                 const streetRaw = street.replace(/^(calle\s+|av\.\s+|avenida\s+)/i, '');
                 const match = streetRaw.match(/^(\d+)([a-zA-Z])$/);
                 
                 if (match) {
                     // Try "Calle 34-C, Neighborhood..."
                     const variant = `${match[1]}-${match[2]}`;
                     q = `Calle ${variant} ${num}, ${neighborhood}, ${city}, ${state}`;
                     data = await fetchFreeText(q);
                     filtered = filterResults(data);
                     if (filtered.length > 0) finalResults = filtered;
                     
                     if (finalResults.length === 0) {
                        // Try "Calle 34 C, Neighborhood..."
                        const variantSpace = `${match[1]} ${match[2]}`;
                        q = `Calle ${variantSpace} ${num}, ${neighborhood}, ${city}, ${state}`;
                        data = await fetchFreeText(q);
                        filtered = filterResults(data);
                        if (filtered.length > 0) finalResults = filtered;
                     }
                 }
             }
        }

        // Strategy 2: Structured search (Street + City + State) - Fallback
        if (finalResults.length === 0 && street) {
             finalResults = await tryStreetStructured(street);
        }

        // Strategy 3: Try adding "Calle" prefix if missing
        if (finalResults.length === 0 && street && !/^(calle|av|avenida|blvd|boulevard|privada|cerrada|calzada)/i.test(street)) {
             finalResults = await tryStreetStructured(`Calle ${street}`);
        }
        
        // Strategy 4: Try splitting number and letter
        if (finalResults.length === 0 && street) {
            const streetRaw = street.replace(/^(calle\s+|av\.\s+|avenida\s+)/i, '');
            // Match "34C" or "34 C" or "34-C"
            const match = streetRaw.match(/^(\d+)\s*[-]?\s*([a-zA-Z])$/);
            if (match) {
                 const variant = `${match[1]} ${match[2]}`; // "34 c"
                 finalResults = await tryStreetStructured(`Calle ${variant}`);
                 
                 if (finalResults.length === 0) {
                     finalResults = await tryStreetStructured(variant);
                 }
                 
                 if (finalResults.length === 0) {
                     const variantHyphen = `${match[1]}-${match[2]}`;
                     finalResults = await tryStreetStructured(`Calle ${variantHyphen}`);
                 }
            }
        }
        
        // Strategy 5: Try Google-style "C. 34c"
        if (finalResults.length === 0 && street) {
            const streetRaw = street.replace(/^(calle\s+|av\.\s+|avenida\s+)/i, '');
             const variantC = `C. ${streetRaw}`;
             finalResults = await tryStreetStructured(variantC);
        }

        // Strategy 6: Fallback to Neighborhood + City + State
        if (finalResults.length === 0 && neighborhood) {
             const q = `${neighborhood}, ${city}, ${state}`;
             const data = await fetchFreeText(q);
             if (data.length > 0) finalResults = data;
        }

        // Strategy 7: Fallback to Postal Code + City + State
        if (finalResults.length === 0 && postalCode) {
             const q = `${postalCode}, ${city}, ${state}`;
             const data = await fetchFreeText(q);
             if (data.length > 0) finalResults = data;
        }

        // Strategy 8: Fallback to City + State (structured)
        if (finalResults.length === 0) {
             finalResults = await fetchStructured({
                 city,
                 state,
                 country
             });
        }
        
        // Strategy 9: Last resort: State + Country
        if (finalResults.length === 0) {
             finalResults = await fetchStructured({
                 state,
                 country
             });
        }

        // Patch results to show correct CP and exterior number if we forced a match
        if (finalResults.length > 0 && (postalCode || num || neighborhood)) {
            finalResults = patchDisplayNames(finalResults, postalCode, num, neighborhood);
        }

        if (rid !== requestIdRef.current || isSelectingRef.current) return;
        setResults(finalResults);
        setQuery(constructQueryFromDetails(addressContext));
        
    } catch (error) {
        console.error("Context search error:", error);
    } finally {
        setSearching(false);
    }
  };

  const addressString = addressContext ? constructQueryFromDetails(addressContext) : "";

  return (
    <div 
        ref={searchRef}
        className="leaflet-control leaflet-bar"
        style={{ 
            position: 'absolute', 
            top: '10px', 
            left: '50px', 
            zIndex: 1000,
            backgroundColor: 'white',
            padding: '5px',
            borderRadius: '4px',
            boxShadow: '0 1px 5px rgba(0,0,0,0.65)'
        }}
    >
      <div className="flex flex-col gap-2" style={{ minWidth: '250px' }}>
        <div className="flex items-center w-full">
          <input
            type="text"
            className="flex-1 p-1 outline-none text-sm border-none"
            placeholder="Buscar dirección..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            ref={inputRef}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button
            onClick={() => handleSearch()}
            className="p-1 text-gray-500 hover:text-gray-700"
            disabled={searching}
            type="button"
          >
            <Search size={16} />
          </button>
        </div>
        <div className="mt-2">
          {addressString && addressString.length > 5 && (
            <button
              type="button"
              onClick={searchWithContext}
              className="w-full text-xs px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2 justify-center"
              title="Buscar con los datos del formulario"
            >
              <span>📍</span>
              <span>Buscar con datos del formulario</span>
            </button>
          )}
        </div>
      </div>
      {results.length > 0 && (
        <ul className="max-h-60 overflow-y-auto border-t mt-2 w-full bg-white">
          {results.map((result: any, index: number) => (
            <li
              key={index}
              className="p-2 hover:bg-gray-100 cursor-pointer text-xs border-b last:border-b-0"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const lat = parseFloat(result.lat);
                const lng = parseFloat(result.lon);
                isSelectingRef.current = true;
                requestIdRef.current++;
                setResults([]);
                onSelect(lat, lng);
                map.flyTo([lat, lng], 13);
                setQuery(result.display_name);
                setTimeout(() => {
                  isSelectingRef.current = false;
                }, 1200);
                inputRef.current?.blur();
              }}
            >
              {result.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function MapPickerClient({
  location,
  onChange,
  readOnly = false,
  height = "300px",
  zoom = 13,
  addressContext,
  className
}: MapPickerClientProps) {
  useEffect(() => {
    fixLeafletIcon();
  }, []);

  // Default to Mexico City if no location provided
  const center = location || { lat: 19.4326, lng: -99.1332 };

  return (
    <div className={`relative w-full md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto rounded-lg overflow-hidden border border-gray-300 z-0 ${className || ''}`} style={{ height }}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={!readOnly}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {!readOnly && onChange && (
          <SearchControl onSelect={(lat, lng) => onChange({ lat, lng })} addressContext={addressContext} />
        )}
        <LocationMarker location={location || null} onChange={onChange} readOnly={readOnly} />
      </MapContainer>
    </div>
  );
}
