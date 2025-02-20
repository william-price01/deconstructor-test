import argparse
import os
import json
from dotenv import load_dotenv
from griptape.configs import Defaults
from griptape.configs.drivers import DriversConfig
from griptape.drivers import GooglePromptDriver
from griptape.structures import Agent


def is_running_in_managed_environment() -> bool:
    return "GT_CLOUD_STRUCTURE_RUN_ID" in os.environ


def setup_config():
    if is_running_in_managed_environment():
        # Cloud environment setup if needed
        pass
    else:
        load_dotenv('../.env.local')

    Defaults.drivers_config = DriversConfig(
        prompt_driver=GooglePromptDriver(
            model="gemini-pro",
            api_key=os.environ["GOOGLE_GENERATIVE_AI_API_KEY"],
        )
    )


def create_word_agent() -> Agent:
    return Agent()


def deconstruct_word(agent: Agent, word: str, previous_attempts: list = None) -> dict:
    # Build the prompt
    if previous_attempts:
        prompt = f"""Deconstruct the word: {word}

Previous attempts:
{json.dumps(previous_attempts, indent=2)}

Please fix all the issues and try again."""
    else:
        prompt = f"Deconstruct the word: {word}"

    system_prompt = """You are a linguistic expert that deconstructs words into their meaningful parts and explains their etymology. Create multiple layers of combinations to form the final meaning of the word.

Schema Requirements:
{
  "thought": "Think about the word/phrase, it's origins, and how it's put together",
  "parts": [
    {
      "id": "Lowercase identifier, unique across parts and combinations",
      "text": "Exact section of input word",
      "originalWord": "Oldest word/affix this part comes from",
      "origin": "Brief origin (Latin, Greek, etc)",
      "meaning": "Concise meaning of this part"
    }
  ],
  "combinations": [
    [
      {
        "id": "Unique lowercase identifier",
        "text": "Combined text segments",
        "definition": "Clear definition of combined parts",
        "sourceIds": ["Array of part/combination ids used"]
      }
    ]
  ]
}

Respond only with a valid JSON object matching this schema exactly."""

    full_prompt = f"{system_prompt}\n\n{prompt}"
    response = agent.run(full_prompt)
    
    try:
        response_text = str(response.output)
        return json.loads(response_text)
    except json.JSONDecodeError:
        raise ValueError("Failed to parse agent response as JSON")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "-w",
        "--word",
        default="universal",
        help="The word to deconstruct",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Show detailed output",
    )

    args = parser.parse_args()
    
    setup_config()
    agent = create_word_agent()
    
    try:
        result = deconstruct_word(agent, args.word)
        if args.verbose:
            print(json.dumps(result, indent=2))
        else:
            # Print just the word breakdown
            parts = ", ".join(f"{p['text']} ({p['meaning']})" for p in result["parts"])
            print(f"Word: {args.word}")
            print(f"Parts: {parts}")
            print(f"Definition: {result['combinations'][-1][0]['definition']}")
    except Exception as e:
        print(f"Error deconstructing word: {e}") 