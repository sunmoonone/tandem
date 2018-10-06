import * as React from "react";
import {
  DependencyGraph,
  PCComponent,
  PCComponentInstanceElement,
  PCElement
} from "paperclip";
import { Dispatch } from "redux";
import { BaseImgPropertiesProps } from "./view.pc";
import { imageSourceInputChanged, imageBrowseButtonClicked } from "actions";

export type Props = {
  sourceNode: PCElement | PCComponentInstanceElement | PCComponent;
  dispatch: Dispatch<any>;
  graph: DependencyGraph;
} & BaseImgPropertiesProps;

export default (Base: React.ComponentClass<BaseImgPropertiesProps>) =>
  class ImgPropertyController extends React.PureComponent<Props> {
    onPathChangeComplete = (value: string) => {
      this.props.dispatch(imageSourceInputChanged(value));
    };
    onUploadButtonClick = () => {
      this.props.dispatch(imageBrowseButtonClicked());
    };
    render() {
      const { sourceNode, ...rest } = this.props;
      const { onUploadButtonClick, onPathChangeComplete } = this;

      if (sourceNode.is !== "img") {
        return null;
      }

      return (
        <Base
          {...rest}
          pathInputProps={{
            value: sourceNode.attributes.src,
            onChangeComplete: onPathChangeComplete
          }}
          uploadButtonProps={{
            onClick: onUploadButtonClick
          }}
        />
      );
    }
  };
