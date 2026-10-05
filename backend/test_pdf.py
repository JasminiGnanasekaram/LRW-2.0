# save as test_pdf.py in backend folder
import fitz
import sys

doc = fitz.open("your_file.pdf")  # change to your PDF filename
for i, page in enumerate(doc):
    text = page.get_text()
    print(f"Page {i+1} text (first 200 chars):")
    print(repr(text[:200]))
    print()