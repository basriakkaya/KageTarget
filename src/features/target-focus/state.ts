export type TargetPanelState = "expanded" | "collapsed" | "peek";
export type TargetPanelEvent =
  | "ANALYSIS_STARTED" | "ANALYSIS_SUCCEEDED" | "ANALYSIS_FAILED"
  | "ANALYSIS_CANCELLED" | "TARGET_CHANGED" | "EXPAND"
  | "PEEK_START" | "PEEK_END";

export function targetPanelTransition(state:TargetPanelState,event:TargetPanelEvent):TargetPanelState {
  if(event==="ANALYSIS_SUCCEEDED") return "collapsed";
  if(["ANALYSIS_STARTED","ANALYSIS_FAILED","ANALYSIS_CANCELLED","TARGET_CHANGED","EXPAND"].includes(event)) return "expanded";
  if(event==="PEEK_START"&&state==="collapsed") return "peek";
  if(event==="PEEK_END"&&state==="peek") return "collapsed";
  return state;
}
