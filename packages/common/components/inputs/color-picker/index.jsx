import './index.scss';
import { parseColor, stringifyColor } from 'common/utils/color';
import { diff } from 'common/utils/object';
import PointerComponent from './pointer';
import { chrome as ColorPickerComponent } from 'react-color';
import MenuComponent from 'common/components/menu';

import React from 'react';

class ColorPickerInput extends React.Component {

  constructor() {
    super();
  }

  onColorChange(color) {
    this.props.reference.setValue(stringifyColor([
      color.rgb.r,
      color.rgb.g,
      color.rgb.b,
      color.rgb.a
    ]));
  }

  /**
   * color picker is slow. Make sure we don't do unecessary renders.
   */

  shouldComponentUpdate(nextProps, nextState) {
    return nextProps.reference !== this.props.reference || !!Object.keys(diff(this.state, nextState)).length;
  }

  render() {
    var ref = this.props.reference;

    var colorValue = ref.getValue() || '#000000';

    var buttonFillStyle = {
      backgroundColor: colorValue
    };

    var createMenu = () => {
      var [r, g, b, a] = parseColor(colorValue);
      return <div className='m-color-picker-popdown--outer'>
        <ColorPickerComponent color={{
          r: r,
          g: g,
          b: b,
          a: a
        }} onChange={this.onColorChange.bind(this)}  />
      </div>
    }

    return <div c
      lassName='m-color-picker-input'
      tabIndex="0"
      onFocus={() => this.refs.menu.show() }
      onKeyDown={(e) =>  e.keyCode === 13 ?  this.refs.menu.hide() : void 0 }>

      <MenuComponent ref='menu' className='m-color-picker-popdown' createMenu={createMenu}>

        <div className='input m-color-picker-input--button'>
          <div style={buttonFillStyle}
            className='m-color-picker-input--button-fill'>
          </div>
        </div>

      </MenuComponent>

    </div>
  }
}

export default ColorPickerInput;
