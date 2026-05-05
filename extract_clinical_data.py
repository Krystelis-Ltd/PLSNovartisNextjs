#!/usr/bin/env python3
"""
Clinical trial data extraction using GPT-5.4 with tool persistence.
Minimal verbosity, maximum correctness.
"""

import json
import os
from pathlib import Path
from openai import OpenAI

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
MODEL = "gpt-5.4"

DEVELOPER_MESSAGE = """You are a Clinical Trial Results extraction expert.
Extract structured data from clinical study reports.

<tool_persistence_rules>
- Use tools whenever they materially improve correctness, completeness, or grounding.
- Do not stop early just to save tool calls.
- Keep calling tools until the task is complete and verification passes.
- If a tool returns empty or partial results, retry with a different strategy.
</tool_persistence_rules>

<structured_output_contract>
- Output ONLY valid JSON matching the requested structure.
- NO markdown formatting (no ```json blocks).
- NO explanations or extra text.
- If data is missing, use empty strings "", empty arrays [], or null.
- Ensure all strings are XML-safe (no control characters).
- Do not invent tables or fields.
</structured_output_contract>

CRITICAL RULES:
- Extract ALL available data - be thorough.
- Use exact numbers from the document.
- Verify data integrity before returning.
"""


def extract_section(user_prompt: str, section_name: str) -> dict:
    """Extract a section using GPT-5.4 with file search."""
    try:
        response = client.beta.messages.create(
            model=MODEL,
            max_tokens=4096,
            system=DEVELOPER_MESSAGE.strip(),
            messages=[{"role": "user", "content": user_prompt}],
        )
        
        # Extract content from response
        raw_text = ""
        for block in response.content:
            if hasattr(block, 'text'):
                raw_text = block.text.strip()
                break
        
        if not raw_text:
            print(f"[{section_name}] No response")
            return {}
        
        # Parse JSON
        data = json.loads(raw_text)
        print(f"[✓] {section_name}")
        return data
        
    except json.JSONDecodeError as e:
        print(f"[✗] {section_name}: JSON parse error - {str(e)[:50]}")
        return {}
    except Exception as e:
        print(f"[✗] {section_name}: {str(e)[:50]}")
        return {}


def extract_trial_data(prompts_dict: dict) -> dict:
    """
    Extract all trial sections from provided prompts.
    
    Args:
        prompts_dict: Dictionary of section_name -> prompt_text
        
    Returns:
        dict: Extracted data for all sections
    """
    print("Starting extraction...")
    extracted = {}
    
    for section_name, prompt_text in prompts_dict.items():
        extracted[section_name] = extract_section(prompt_text, section_name)
    
    return extracted


def validate_extraction(data: dict) -> tuple[bool, list]:
    """Validate extracted data."""
    errors = []
    
    for section, content in data.items():
        if not isinstance(content, (dict, list)):
            errors.append(f"{section}: Invalid type {type(content)}")
        elif isinstance(content, dict) and not content:
            errors.append(f"{section}: Empty")
    
    return len(errors) == 0, errors


def save_results(data: dict, output_file: str = "extraction_results.json"):
    """Save extracted data to JSON."""
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Saved: {output_file}")
    return output_file


def main():
    """Main execution."""
    # Example prompts - replace with actual prompts from extracted_data.json
    example_prompts = {
        "trial_parts": """Extract trial parts from the clinical study report.
        Return JSON: {"parts": [], "description": ""}""",
        
        "early_termination": """Check if trial terminated early.
        Return JSON: {"terminated": false, "date": "", "reason": ""}""",
        
        "participant_flow": """Extract participant flow data.
        Return JSON: {"total": 0, "completed": 0, "withdrew": 0}"""
    }
    
    # Run extraction
    results = extract_trial_data(example_prompts)
    
    # Validate
    is_valid, errors = validate_extraction(results)
    if errors:
        print(f"Validation warnings: {len(errors)}")
        for err in errors[:5]:
            print(f"  - {err}")
    
    # Save
    save_results(results)
    print("Extraction complete.")


if __name__ == "__main__":
    main()
