# Product Evidence

Product Trust keeps product identity, data coverage and physical-item authenticity separate.

## Automatic lookup order

1. Product Trust manufacturer database
2. Open Facts universal barcode lookup
3. UPCitemdb general-retail lookup
4. USDA FoodData Central for food enrichment
5. Optional SerpApi public-web research when structured product records are incomplete
6. Public manufacturer/retailer pages discovered through a product QR code or website printed on the physical label
7. OCR.Space physical-label/nameplate extraction

OCR results are merged back into the main product profile instead of remaining isolated on the OCR screen. Repeated label scans can progressively enrich the same saved scan-history record.

## Scanner behaviour

The camera visually isolates a center scan frame and darkens/blurs the surrounding camera area. When Expo reports barcode bounds/corner points, codes outside the center frame are ignored. GS1 QR/DataMatrix, normal product-website QR codes, EAN, UPC and GTIN are supported.

## Missing information

The app shows all available verifiable information, but it does not invent missing manufacturing locations, nutrition, ingredients, model numbers or other facts. If structured sources miss a product, web research and physical-label evidence can continue identification.
