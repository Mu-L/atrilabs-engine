import { useEffect } from "react";
import { subscribeCanvasActivity } from "@atrilabs/canvas-runtime";
import { useHoverOverlay } from "./overlays/useHoverOverlay";
import { useSelectOverlay } from "./overlays/useSelectOverlay";
import { useHoverWhileSelectedOverlay } from "./overlays/useHoverWhileSelectedOverlay";
import { useSubscribeNewDrag } from "./overlays/useSubscribeNewDrag";

export default function () {
  // overlays during hover
  useHoverOverlay();
  // overlays for a selected component
  useSelectOverlay();
  // overlays for a component hovered while other is selected
  useHoverWhileSelectedOverlay();
  useEffect(() => {
    const unsub = subscribeCanvasActivity("dragStart", (context, event) => {
      console.log("dragStart", context, event);
    });
    return unsub;
  }, []);
  useEffect(() => {
    const unsub = subscribeCanvasActivity(
      "dropzoneCreated",
      (context, event) => {
        console.log("dropzoneCreated", context, event);
      }
    );
    return unsub;
  }, []);
  useEffect(() => {
    const unsub = subscribeCanvasActivity(
      "dropzoneDestroyed",
      (context, event) => {
        console.log("dropzoneDestroyed", context, event);
      }
    );
    return unsub;
  }, []);
  useEffect(() => {
    const unsub = subscribeCanvasActivity("dragEnd", (context, event) => {
      console.log("dragEnd", context, event);
    });
    return unsub;
  }, []);
  useEffect(() => {
    const unsub = subscribeCanvasActivity("dragCancel", (context, event) => {
      console.log("dragCancel", context, event);
    });
    return unsub;
  }, []);
  useSubscribeNewDrag();
  return <></>;
}