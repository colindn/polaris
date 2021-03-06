import * as React from 'react';
import autobind from '@shopify/javascript-utilities/autobind';
import {nodeContainsDescendant} from '@shopify/javascript-utilities/dom';
import {write} from '@shopify/javascript-utilities/fastdom';
import {findFirstFocusableNode} from '@shopify/javascript-utilities/focus';
import {classNames} from '@shopify/react-utilities/styles';
import {isElementOfType, wrapWithComponent} from '@shopify/react-utilities/components';
import {TransitionGroup, TransitionStatus} from '@shopify/react-utilities/animation';

import {Keys} from '../../types';
import {overlay} from '../shared';
import EventListener from '../EventListener';
import KeypressListener from '../KeypressListener';
import PositionedOverlay, {OverlayDetails, PreferredPosition} from '../PositionedOverlay';

import Pane, {Props as PaneProps} from './Pane';
import * as styles from './Popover.scss';

export enum CloseSource {
  Click,
  EscapeKeypress,
  FocusOut,
  ScrollOut,
}

export interface Props {
  id: string,
  active: boolean,
  preventAutofocus?: boolean,
  sectioned?: boolean,
  preferredPosition?: PreferredPosition,
  children?: React.ReactNode,
  activator: HTMLElement,
  onClose(source: CloseSource): void,
}

export default class PopoverOverlay extends React.PureComponent<Props, never> {
  private contentNode: HTMLElement | null;

  componentDidUpdate({active: wasActive}: Props) {
    const {active, preventAutofocus} = this.props;
    if (!active || preventAutofocus || !active || active === wasActive) { return; }
    if (this.contentNode == null) { return; }

    write(() => {
      if (this.contentNode == null) { return; }
      const focusableChild = findFirstFocusableNode(this.contentNode);
      (focusableChild || this.contentNode).focus();
    });
  }

  render() {
    const {active} = this.props;
    const selector = `.${styles.Popover}`;
    const markup = active
      ? (
        <TransitionGroup.TransitionChild
          render={this.renderOverlay}
          selector={selector}
          skipAppearing
          skipEntering
        />
      )
      : null;

    return (
      <TransitionGroup>
        {markup}
      </TransitionGroup>
    );
  }

  @autobind
  private renderOverlay(transitionStatus: TransitionStatus) {
    const {
      active,
      activator,
      preferredPosition = 'below',
    } = this.props;

    return (
      <PositionedOverlay
        active={active}
        activator={activator}
        preferredPosition={preferredPosition}
        render={this.renderPopover.bind(this, transitionStatus)}
        onScrollOut={this.handleScrollOut}
      />
    );
  }

  @autobind
  private renderPopover(transitionStatus: TransitionStatus, overlayDetails: OverlayDetails) {
    const {
      measuring,
      left,
      desiredHeight,
      positioning,
      activatorRect,
    } = overlayDetails;

    const {
      id,
      children,
      sectioned,
    } = this.props;

    const className = classNames(
      styles.Popover,
      transitionStatus && animationVariations(transitionStatus),
      positioning === 'above' && styles.positionedAbove,
      measuring && styles.measuring,
    );

    const tipMarkup = !measuring
      ? (
        <div
          style={{left: activatorRect.center.x - left}}
          className={styles.Tip}
        />
      )
      : null;

    const contentStyles = measuring
      ? undefined
      : {height: desiredHeight};

    const content = (
      <div
        id={id}
        tabIndex={-1}
        className={styles.Content}
        style={contentStyles}
        ref={this.setContentNode}
      >
        {renderPopoverContent(children, {sectioned})}
      </div>
    );

    return (
      <div className={className} {...overlay.props}>
        <EventListener event="click" handler={this.handleClick} />
        <EventListener event="touchstart" handler={this.handleClick} />
        <KeypressListener keyCode={Keys.ESCAPE} handler={this.handleEscape} />
        {tipMarkup}
        <div className={styles.FocusTracker} tabIndex={0} onFocus={this.handleFocusFirstItem} />
        <div className={styles.Wrapper}>
          {content}
        </div>
        <div className={styles.FocusTracker} tabIndex={0} onFocus={this.handleFocusLastItem} />
      </div>
    );
  }

  @autobind
  private setContentNode(node: HTMLElement | null) {
    this.contentNode = node;
  }

  @autobind
  private handleClick(event: Event) {
    const target = event.target as HTMLElement;
    const {contentNode, props: {activator, onClose}} = this;
    if (
      (contentNode != null && nodeContainsDescendant(contentNode, target)) ||
      nodeContainsDescendant(activator, target)
    ) { return; }
    onClose(CloseSource.Click);
  }

  @autobind
  private handleScrollOut() {
    this.props.onClose(CloseSource.ScrollOut);
  }

  @autobind
  private handleEscape() {
    this.props.onClose(CloseSource.EscapeKeypress);
  }

  @autobind
  private handleFocusFirstItem() {
    this.props.onClose(CloseSource.FocusOut);
  }

  @autobind
  private handleFocusLastItem() {
    this.props.onClose(CloseSource.FocusOut);
  }
}

function renderPopoverContent(children: React.ReactNode, props?: Partial<PaneProps>) {
  const childrenArray = React.Children.toArray(children);
  if (isElementOfType(childrenArray[0], Pane)) { return childrenArray; }
  return wrapWithComponent(childrenArray, Pane, props);
}

function animationVariations(status: TransitionStatus) {
  switch (status) {
    case TransitionStatus.Leaving:
      return styles.leaving;
    default:
      return null;
  }
}
