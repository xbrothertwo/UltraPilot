"""Patch an exported UltraPilot Apple Shortcut before signing it again."""

from __future__ import annotations

import argparse
import plistlib
from pathlib import Path
from typing import Any


TOKEN_PLACEHOLDER = "up_health_v1_HIER_NEUEN_SCHLUESSEL_EINFUEGEN"


def action(workflow: dict[str, Any], index: int, identifier: str) -> dict[str, Any]:
    actions = workflow.get("WFWorkflowActions")
    if not isinstance(actions, list) or index >= len(actions):
        raise ValueError("The Shortcut action list is incomplete.")
    candidate = actions[index]
    if not isinstance(candidate, dict) or candidate.get("WFWorkflowActionIdentifier") != identifier:
        raise ValueError(f"Unexpected Shortcut action at index {index}.")
    return candidate


def patch_shortcut(source: Path, destination: Path) -> None:
    with source.open("rb") as source_file:
        workflow = plistlib.load(source_file)

    token_action = action(workflow, 0, "is.workflow.actions.gettext")
    token_parameters = token_action.setdefault("WFWorkflowActionParameters", {})
    token_parameters["WFTextActionText"] = TOKEN_PLACEHOLDER

    workflow["WFWorkflowImportQuestions"] = [
        {
            "ParameterKey": "WFTextActionText",
            "Category": "Parameter",
            "ActionIndex": 0,
            "Text": "Neuen UltraPilot-Verbindungsschlüssel einfügen",
            "DefaultValue": TOKEN_PLACEHOLDER,
        }
    ]

    records_action = action(workflow, 51, "is.workflow.actions.setvalueforkey")
    records_parameters = records_action.setdefault("WFWorkflowActionParameters", {})
    records_key = records_parameters.get("WFDictionaryKey")
    records_value = records_parameters.get("WFDictionaryValue")
    if records_key is None or records_value != "records":
        raise ValueError("The expected reversed records assignment was not found.")
    records_parameters["WFDictionaryKey"] = records_value
    records_parameters["WFDictionaryValue"] = records_key

    request_action = action(workflow, 54, "is.workflow.actions.downloadurl")
    request_parameters = request_action.setdefault("WFWorkflowActionParameters", {})
    request_body = request_parameters.pop("WFRequestVariable", None)
    if request_body is None:
        raise ValueError("The Shortcut request body is missing.")
    request_parameters["WFJSONValues"] = request_body
    request_parameters["WFHTTPBodyType"] = "JSON"

    header_items = (
        request_parameters.get("WFHTTPHeaders", {})
        .get("Value", {})
        .get("WFDictionaryFieldValueItems", [])
    )
    if isinstance(header_items, list):
        request_parameters["WFHTTPHeaders"]["Value"]["WFDictionaryFieldValueItems"] = [
            item
            for item in header_items
            if item.get("WFKey", {}).get("Value", {}).get("string")
        ]

    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as destination_file:
        plistlib.dump(workflow, destination_file, fmt=plistlib.FMT_BINARY, sort_keys=False)

    def contains_connection_key(value: Any) -> bool:
        if isinstance(value, dict):
            return any(contains_connection_key(item) for item in value.values())
        if isinstance(value, list):
            return any(contains_connection_key(item) for item in value)
        return isinstance(value, str) and value.startswith("up_health_v1_") and value != TOKEN_PLACEHOLDER

    if contains_connection_key(workflow):
        raise ValueError("A connection key remains in the patched Shortcut.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    arguments = parser.parse_args()
    patch_shortcut(arguments.source, arguments.destination)


if __name__ == "__main__":
    main()
