import React, { useEffect } from "react";
import { createMachine, assign, interpret } from "xstate";
import { canvasComponentStore } from "../CanvasComponentData";
import { DecoratorProps, DecoratorRenderer } from "../DecoratorRenderer";
import { getCoords, insideBox } from "../utils";

// states
const idle = "idle" as "idle";
const hover = "hover" as "hover";
const pressed = "pressed" as "pressed";
const select = "select" as "select";
const selectIdle = "selectIdle" as "selectIdle";
const dragstart = "dragstart" as "dragstart";
const dragstartIdle = "dragstartIdle" as "dragstartIdle";
const drag = "drag" as "drag";
const hoverWhileSelected = "hoverWhileSelected" as "hoverWhileSelected";

const lockCompDrop = "lockCompDrop" as "lockCompDrop";
const lockDataDrop = "lockDataDrop" as "lockDataDrop";
const lockDataDropIdle = "lockDataDropIdle" as "lockDataDropIdle";
const lockDataDropSet = "lockDataDropSet" as "lockDataDropSet";

// events
type OVER = "OVER";
type DOWN = "DOWN";
type UP = "UP";
type AUTO = "AUTO";
type OUT_OF_CANVAS = "OUT_OF_CANVAS";
type LOCK_COMP_DROP = "LOCK_COMP_DROP"; // dropping new component
type LOCK_DATA_DROP = "LOCK_DATA_DROP"; // dropping src etc.
type UNLOCK_EVENT = "UNLOCK_EVENT";
type CANCEL_LOCK_EVENT = "CANCEL_LOCK_EVENT";
type SET_DATA_DROP_TARGET = "SET_DATA_DROP_TARGET";
type UNSET_DATA_DROP_TARGET = "UNSET_DATA_DROP_TARGET";
type CLEAR_CANVAS_EVENT = "CLEAR_CANVAS_EVENT";

type OverEvent = {
  type: OVER;
  id: string;
};

type DownEvent = {
  type: DOWN;
  id: string;
};

type UpEvent = {
  type: UP;
  id: string;
};

type AutoTransitionEvent = {
  type: AUTO;
};

type OutOfCanvasEvent = {
  type: OUT_OF_CANVAS;
};

type LockCompDropEvent = {
  type: LOCK_COMP_DROP;
  compId: string;
};

type LockDataDropEvent = {
  type: LOCK_DATA_DROP;
};

type SetDropTargetEvent = {
  type: SET_DATA_DROP_TARGET;
  targetId: string;
};

type UnsetDropTargetEvent = {
  type: UNSET_DATA_DROP_TARGET;
};

// unlock event always takes you to the select state
type UnlockEvent = {
  type: UNLOCK_EVENT;
};

// cacel lock event always takes you to the idle state
type CancelLockEvent = {
  type: CANCEL_LOCK_EVENT;
};

// Canvas gets cleared when the forest is reset
type ClearCanvasEvent = {
  type: CLEAR_CANVAS_EVENT;
};

type CanvasActivityEvent =
  | OverEvent
  | DownEvent
  | UpEvent
  | AutoTransitionEvent
  | OutOfCanvasEvent
  | LockCompDropEvent
  | LockDataDropEvent
  | UnlockEvent
  | CancelLockEvent
  | SetDropTargetEvent
  | UnsetDropTargetEvent
  | ClearCanvasEvent;

// context
type CanvasActivityContext = {
  // component being dragged
  dragged?: {
    id: string;
  };
  // component hovered over during drag
  currentDropzone?: {
    id: string;
  };
  // component where drop happens at the end of drag
  finalDropzone?: {
    id: string;
  };
  hover?: {
    id: string;
  };
  select?: {
    id: string;
  };
  dropComp?: {
    id: string;
  };
  dropData?: {
    id: string;
  };
};

const overAnother = (context: CanvasActivityContext, event: OverEvent) => {
  return context.hover?.id !== event.id;
};

const overNotSelected = (context: CanvasActivityContext, event: OverEvent) => {
  return context.select?.id !== event.id;
};

const hoverWhileSelectedGuard = (
  context: CanvasActivityContext,
  event: OverEvent
) => {
  return overAnother(context, event) && overNotSelected(context, event);
};

const notOverDragged = (context: CanvasActivityContext, event: OverEvent) => {
  return context.dragged?.id !== event.id;
};

const overNotLastDragOver = (
  context: CanvasActivityContext,
  event: OverEvent
) => {
  return (
    context.currentDropzone?.id !== event.id &&
    context.currentDropzone?.id !== event.id
  );
};

const dragOverGuard = (context: CanvasActivityContext, event: OverEvent) => {
  return overNotLastDragOver(context, event) && notOverDragged(context, event);
};

// mouse up on component other than the dragged
const dropOnNotDragged = (context: CanvasActivityContext, event: UpEvent) => {
  return context.dragged?.id !== event.id;
};
// mouse up on the dragged component itself
const dropOnDragged = (context: CanvasActivityContext, event: UpEvent) => {
  return context.dragged?.id === event.id;
};

const dropDataIsSet = (context: CanvasActivityContext) => {
  if (context.dropData && context.dropData.id) {
    return true;
  }
  return false;
};

const dropDataIsNotSet = (context: CanvasActivityContext) => {
  return !dropDataIsSet(context);
};

const onHoverStart = assign<CanvasActivityContext, OverEvent>({
  hover: (_context, event) => {
    return { id: event.id };
  },
});

const onSelect = assign<CanvasActivityContext, UpEvent>({
  select: (_context, event) => {
    return {
      id: event.id,
    };
  },
});

const onDragStart = assign<CanvasActivityContext, OverEvent>({
  dragged: (_context, event) => {
    return {
      id: event.id,
    };
  },
});

const onDragOverStart = assign<CanvasActivityContext, OverEvent>({
  currentDropzone: (_context, event) => {
    return {
      id: event.id,
    };
  },
});

const onDragEnd = assign<CanvasActivityContext, UpEvent>({
  finalDropzone: (_context, event) => {
    return {
      id: event.id,
    };
  },
  select: (context) => {
    if (context.dragged === undefined) {
      console.error(
        "The context.dragged was expected to be defined at drag end. Please report this error as it might be some problem in Canvas Runtime"
      );
    }
    return {
      id: context.dragged!.id,
    };
  },
});

const onDragCancel = assign<CanvasActivityContext, UpEvent>({
  finalDropzone: (_context, event) => {
    return {
      id: event.id,
    };
  },

  select: (context) => {
    if (context.dragged === undefined) {
      console.error(
        "The context.dragged was expected to be defined at drag end. Please report this error as it might be some problem in Canvas Runtime"
      );
    }
    return {
      id: context.dragged!.id,
    };
  },
});

const setSelectOnOutOfCanvasOnDragFail = assign<
  CanvasActivityContext,
  OutOfCanvasEvent
>({
  select: (context) => {
    if (!context.dragged?.id) {
      console.error(
        "context.dragged was expected to be defined. Please report this error to Atri Labs team."
      );
    }
    return { id: context.dragged!.id };
  },
});

const onLockCompDrop = assign<CanvasActivityContext, LockCompDropEvent>({
  dropComp: (_context, event) => {
    return { id: event.compId };
  },
});

const onSetLockDataDrop = assign<CanvasActivityContext, SetDropTargetEvent>({
  dropData: (_context, event) => {
    return { id: event.targetId };
  },
});

const onUnsetLockDataDrop = assign<CanvasActivityContext, UnsetDropTargetEvent>(
  {
    dropData: () => {
      return undefined;
    },
  }
);

const selectOnUnlockCompDrop = assign<CanvasActivityContext, UnlockEvent>({
  select: (context) => {
    return { id: context.dropComp!.id };
  },
  dropComp: () => {
    return undefined;
  },
});

const selectOnUnlockDataDrop = assign<CanvasActivityContext, UnlockEvent>({
  select: (context) => {
    return { id: context.dropData!.id };
  },
  dropData: () => {
    return undefined;
  },
});

const canvasActivityMachine = createMachine<
  CanvasActivityContext,
  CanvasActivityEvent
>({
  id: "canvasActivityMachine",
  context: {},
  initial: idle,
  states: {
    [idle]: {
      on: {
        OVER: { target: hover, actions: [onHoverStart] },
        LOCK_COMP_DROP: { target: lockCompDrop, actions: [onLockCompDrop] },
        LOCK_DATA_DROP: { target: lockDataDrop },
      },
      entry: assign({}),
    },
    [hover]: {
      on: {
        OVER: { target: hover, cond: overAnother, actions: [onHoverStart] },
        DOWN: { target: pressed },
        OUT_OF_CANVAS: { target: idle },
        CLEAR_CANVAS_EVENT: { target: idle },
      },
      entry: (context, event) => {
        hoverCbs.forEach((cb) => cb(context, event));
      },
      exit: (context, event) => {
        hoverEndCbs.forEach((cb) => cb(context, event));
      },
    },
    [pressed]: {
      on: {
        UP: { target: select, actions: [onSelect] },
        OVER: { target: dragstart, actions: [onDragStart] },
      },
      entry: () => {
        console.log("entered pressed state");
      },
      exit: () => {
        console.log("exiting pressed state");
      },
    },
    [select]: {
      on: {
        // use might do mouse down on the selected component
        // maybe to start dragging
        DOWN: {
          target: pressed,
        },
        LOCK_COMP_DROP: { target: lockCompDrop, actions: [onLockCompDrop] },
        LOCK_DATA_DROP: { target: lockDataDrop },
        CLEAR_CANVAS_EVENT: { target: idle },
      },
      type: "compound",
      initial: selectIdle,
      states: {
        [selectIdle]: {
          on: {
            OVER: {
              target: hoverWhileSelected,
              cond: overNotSelected,
              actions: [onHoverStart],
            },
          },
        },
        [hoverWhileSelected]: {
          on: {
            OVER: [
              {
                target: hoverWhileSelected,
                cond: hoverWhileSelectedGuard,
                actions: [onHoverStart],
              },
              {
                target: selectIdle,
                cond: (context, event) => {
                  return !overNotSelected(context, event);
                },
              },
            ],
            OUT_OF_CANVAS: { target: selectIdle },
          },
          entry: (context, event) => {
            hoverWhileSelectedCbs.forEach((cb) => cb(context, event));
          },
          exit: (context, event) => {
            hoverWhileSelectedEndCbs.forEach((cb) => cb(context, event));
          },
        },
      },
      entry: (context, event) => {
        selectCbs.forEach((cb) => cb(context, event));
      },
      exit: (context, event) => {
        selectEndCbs.forEach((cb) => cb(context, event));
      },
    },
    [dragstart]: {
      type: "compound",
      initial: dragstartIdle,
      on: {
        // mouse up on the same component before starting drag (moving to other component)
        UP: [
          // TODO: dragend and dragcancel, both should lead to select state with dragged as selected
          { target: select, cond: dropOnNotDragged, actions: [onDragEnd] },
          {
            target: select,
            cond: dropOnDragged,
            actions: [onDragCancel],
          },
        ],
        OUT_OF_CANVAS: {
          target: select,
          actions: [setSelectOnOutOfCanvasOnDragFail],
        },
      },
      states: {
        [dragstartIdle]: {
          on: {
            OVER: {
              target: drag,
              cond: notOverDragged,
              actions: [onDragOverStart],
            },
          },
        },
        // drag state is synononomous to dropzone created state
        [drag]: {
          on: {
            OVER: [
              {
                target: drag,
                cond: dragOverGuard,
                actions: [onDragOverStart],
              },
              {
                target: dragstartIdle,
                cond: (context, event) => {
                  return !notOverDragged(context, event);
                },
              },
            ],
          },
          entry: (context, event) => {
            dropzoneCreatedCbs.forEach((cb) => cb(context, event));
          },
          exit: (context, event) => {
            dropzoneDestroyedCbs.forEach((cb) => cb(context, event));
          },
        },
      },
      entry: (context, event) => {
        dragStartCbs.forEach((cb) => cb(context, event));
      },
      exit: (context, event) => {
        if (context.dragged === context.finalDropzone) {
          dragCancelCbs.forEach((cb) => cb(context, event));
        } else {
          dragEndCbs.forEach((cb) => cb(context, event));
        }
      },
    },
    [lockCompDrop]: {
      on: {
        UNLOCK_EVENT: { target: select, actions: [selectOnUnlockCompDrop] },
        CANCEL_LOCK_EVENT: { target: idle },
        CLEAR_CANVAS_EVENT: { target: idle },
      },
    },
    [lockDataDrop]: {
      on: {
        UNLOCK_EVENT: [
          {
            target: select,
            cond: dropDataIsSet,
            actions: [selectOnUnlockDataDrop],
          },
          {
            target: idle,
            cond: dropDataIsNotSet,
          },
        ],
        CANCEL_LOCK_EVENT: { target: idle },
        CLEAR_CANVAS_EVENT: { target: idle },
      },
      type: "compound",
      initial: lockDataDropIdle,
      states: {
        [lockDataDropIdle]: {
          on: {
            SET_DATA_DROP_TARGET: {
              target: lockDataDropSet,
              actions: [onSetLockDataDrop],
            },
          },
        },
        [lockDataDropSet]: {
          on: {
            SET_DATA_DROP_TARGET: {
              target: lockDataDropSet,
              actions: [onSetLockDataDrop],
            },
            UNSET_DATA_DROP_TARGET: {
              target: lockDataDropIdle,
              actions: [onUnsetLockDataDrop],
            },
          },
        },
      },
    },
  },
});

// callbacks
type Callback = (
  context: CanvasActivityContext,
  event: CanvasActivityEvent
) => void;
const hoverCbs: Callback[] = [];
const hoverEndCbs: Callback[] = [];
const selectCbs: Callback[] = [];
const selectEndCbs: Callback[] = [];
const hoverWhileSelectedCbs: Callback[] = [];
const hoverWhileSelectedEndCbs: Callback[] = [];
const dragStartCbs: Callback[] = [];
const dropzoneCreatedCbs: Callback[] = [];
const dropzoneDestroyedCbs: Callback[] = [];
const dragEndCbs: Callback[] = [];
const dragCancelCbs: Callback[] = [];

function createUnsubFunc(arr: Callback[], cb: Callback) {
  return () => {
    const index = arr.findIndex((curr) => curr === cb);
    if (index >= 0) {
      return arr.splice(index, 1);
    }
  };
}

function subscribe(
  event:
    | "hover"
    | "hoverEnd"
    | "select"
    | "selectEnd"
    | "hoverWhileSelected"
    | "hoverWhileSelectedEnd"
    | "dragStart"
    | "dropzoneCreated"
    | "dropzoneDestroyed"
    | "dragEnd"
    | "dragCancel",
  cb: Callback
) {
  switch (event) {
    case "hover":
      hoverCbs.push(cb);
      return createUnsubFunc(hoverCbs, cb);
    case "hoverEnd":
      hoverEndCbs.push(cb);
      return createUnsubFunc(hoverEndCbs, cb);
    case "select":
      selectCbs.push(cb);
      return createUnsubFunc(selectCbs, cb);
    case "selectEnd":
      selectEndCbs.push(cb);
      return createUnsubFunc(selectEndCbs, cb);
    case "hoverWhileSelected":
      hoverWhileSelectedCbs.push(cb);
      return createUnsubFunc(hoverWhileSelectedCbs, cb);
    case "hoverWhileSelectedEnd":
      hoverWhileSelectedEndCbs.push(cb);
      return createUnsubFunc(hoverWhileSelectedEndCbs, cb);
    case "dragStart":
      dragStartCbs.push(cb);
      return createUnsubFunc(dragStartCbs, cb);
    case "dropzoneCreated":
      dropzoneCreatedCbs.push(cb);
      return createUnsubFunc(dropzoneCreatedCbs, cb);
    case "dropzoneDestroyed":
      dropzoneDestroyedCbs.push(cb);
      return createUnsubFunc(dropzoneDestroyedCbs, cb);
    case "dragEnd":
      dragEndCbs.push(cb);
      return createUnsubFunc(dragEndCbs, cb);
    case "dragCancel":
      dragCancelCbs.push(cb);
      return createUnsubFunc(dragCancelCbs, cb);
    default:
      console.error(
        `Unknown event received by ${canvasActivityMachine.id} - ${event}`
      );
  }
  return () => {};
}

const service = interpret(canvasActivityMachine);
service.start();

// Event listeners are attached to window to reset the event handling.
// Once the event has been handled by a component,
// we don't want the event to propagate to parent component.
let overHandled = false;
let upHandled = false;
let downHandled = false;
window.addEventListener("mousemove", () => {
  overHandled = false;
});
window.addEventListener("mouseup", () => {
  upHandled = false;
});
window.addEventListener("mousedown", () => {
  downHandled = false;
});

const CanvasActivityDecorator: React.FC<DecoratorProps> = (props) => {
  useEffect(() => {
    // useEffect for body only
    if (props.compId === "body") {
      const mousemove = (event: MouseEvent) => {
        const body = canvasComponentStore[props.compId].ref.current!;
        if (!insideBox(event, getCoords(body))) {
          service.send({ type: "OUT_OF_CANVAS" });
        }
      };
      window.addEventListener("mousemove", mousemove, { capture: true });
      return () => {
        window.removeEventListener("mousemove", mousemove);
      };
    }
  }, [props]);
  useEffect(() => {
    const comp = canvasComponentStore[props.compId].ref.current;
    if (comp) {
      const mouseover = () => {
        if (overHandled) return;
        overHandled = true;
        service.send({
          type: "OVER",
          id: props.compId,
        });
      };
      const mousedown = () => {
        if (downHandled) return;
        downHandled = true;
        service.send({
          type: "DOWN",
          id: props.compId,
        });
      };
      const mouseup = () => {
        if (upHandled) return;
        upHandled = true;
        service.send({
          type: "UP",
          id: props.compId,
        });
      };
      comp.addEventListener("mousedown", mousedown);
      comp.addEventListener("mousemove", mouseover);
      comp.addEventListener("mouseup", mouseup);
      return () => {
        if (comp) {
          comp.removeEventListener("mousedown", mousedown);
          comp.removeEventListener("mousemove", mouseover);
          comp.removeEventListener("mouseup", mouseup);
        }
      };
    } else {
      console.error(
        "The comp Ref is null. Please report this error to Atri Labs team."
      );
    }
    return;
  }, [props]);

  return <DecoratorRenderer {...props} />;
};

// =================== API for internal use only =====================

function lockMachineForCompDrop(compId: string) {
  service.send({ type: "LOCK_COMP_DROP", compId });
}

function lockMachineForDataDrop() {
  service.send({ type: "LOCK_DATA_DROP" });
}

function setDataDropTarget(targetId: string) {
  service.send({ type: "SET_DATA_DROP_TARGET", targetId });
}

function unsetDataDropTarget() {
  service.send({ type: "UNSET_DATA_DROP_TARGET" });
}

function unlockMachine() {
  service.send({ type: "UNLOCK_EVENT" });
}

function cancelMachineLock() {
  service.send({ type: "CANCEL_LOCK_EVENT" });
}

function getCompDropTarget() {
  return service.state.context.dropComp?.id;
}

function getDataDropTarget() {
  return service.state.context.dropData?.id;
}

function isMachineLocked() {
  return (
    service.state.value === lockCompDrop || service.state.value === lockDataDrop
  );
}

function emitClearCanvasEvent() {
  service.send({ type: "CLEAR_CANVAS_EVENT" });
}

// ===================================================================

export {
  subscribe,
  CanvasActivityDecorator,
  lockMachineForCompDrop,
  lockMachineForDataDrop,
  unlockMachine,
  cancelMachineLock,
  setDataDropTarget,
  unsetDataDropTarget,
  getCompDropTarget,
  getDataDropTarget,
  isMachineLocked,
  emitClearCanvasEvent,
};